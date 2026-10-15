import { db } from "@/lib/db";
import { plaidClient } from "@/lib/plaid";
import { roundMoney } from "@/lib/money";
import { appTodayDate } from "@/lib/appTime";
import type { Security as PlaidSecurity } from "plaid";

export type InvestmentSyncStatus = "synced" | "pending" | "needs_consent" | "not_supported" | "no_accounts";

// Plaid errors that just mean "this item has no investments data for us" — not failures
const CONSENT_ERRORS = new Set(["ADDITIONAL_CONSENT_REQUIRED", "INVALID_PRODUCT"]);
const UNSUPPORTED_ERRORS = new Set(["PRODUCTS_NOT_SUPPORTED", "NO_INVESTMENT_ACCOUNTS", "NO_INVESTMENT_AUTH_ACCOUNTS"]);

async function upsertSecurities(securities: PlaidSecurity[]): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const s of securities) {
    const data = {
      ticker: s.ticker_symbol,
      name: s.name,
      type: s.type,
      isCashEquivalent: Boolean(s.is_cash_equivalent),
      closePrice: s.close_price,
      closePriceAsOf: s.close_price_as_of ? new Date(s.close_price_as_of) : null,
    };
    const row = await db.security.upsert({
      where: { plaidSecurityId: s.security_id },
      create: { plaidSecurityId: s.security_id, ...data },
      update: data,
      select: { id: true },
    });
    ids.set(s.security_id, row.id);
  }
  return ids;
}

/**
 * Pulls holdings and the last 24 months of investment activity for one Plaid item.
 * Holdings are replaced wholesale per account so sold positions disappear.
 */
export async function syncInvestmentsForItem(
  accessToken: string,
  dbAccounts: { id: string; plaidAccountId: string; type: string }[]
): Promise<InvestmentSyncStatus> {
  if (!dbAccounts.some((a) => a.type === "investment")) return "no_accounts";

  let holdingsRes;
  try {
    holdingsRes = await plaidClient.investmentsHoldingsGet({ access_token: accessToken });
  } catch (err: any) {
    const code = err?.response?.data?.error_code;
    if (CONSENT_ERRORS.has(code)) return "needs_consent";
    if (UNSUPPORTED_ERRORS.has(code)) return "not_supported";
    throw err;
  }

  const accountIdByPlaid = new Map(dbAccounts.map((a) => [a.plaidAccountId, a.id]));
  const securityIds = await upsertSecurities(holdingsRes.data.securities);

  // Merge lots of the same security within an account (401(k)s report one per source:
  // pre-tax, Roth, match…) — the (account, security) unique key would otherwise drop all but one.
  type Row = {
    accountId: string;
    securityId: string;
    quantity: number;
    costBasis: number | null;
    institutionPrice: number;
    institutionValue: number;
    priceAsOf: Date | null;
  };
  const merged = new Map<string, Row>();
  for (const h of holdingsRes.data.holdings) {
    const accountId = accountIdByPlaid.get(h.account_id);
    const securityId = securityIds.get(h.security_id);
    if (!accountId || !securityId) continue;
    const key = `${accountId}:${securityId}`;
    const prev = merged.get(key);
    merged.set(key, {
      accountId,
      securityId,
      quantity: (prev?.quantity ?? 0) + h.quantity,
      // Unknown cost on any lot makes the combined cost unknown
      costBasis: prev && prev.costBasis === null ? null : h.cost_basis === null ? null : (prev?.costBasis ?? 0) + h.cost_basis,
      institutionPrice: h.institution_price,
      institutionValue: roundMoney((prev?.institutionValue ?? 0) + h.institution_value),
      priceAsOf: h.institution_price_as_of ? new Date(h.institution_price_as_of) : prev?.priceAsOf ?? null,
    });
  }
  const rows = [...merged.values()];

  // Only replace holdings for accounts Plaid actually itemized. Right after the user
  // changes sharing, Plaid briefly reports funded accounts with zero holdings while it
  // re-fetches; wiping those would erase good data. A funded account always has at
  // least a cash line, so "zero holdings + non-zero balance" means "not ready / not shared".
  const itemized = new Set(holdingsRes.data.holdings.map((h) => h.account_id));
  const balanceByPlaid = new Map(holdingsRes.data.accounts.map((a) => [a.account_id, a.balances.current ?? 0]));
  const replaceAccounts = holdingsRes.data.accounts
    .filter((a) => itemized.has(a.account_id) || Math.abs(balanceByPlaid.get(a.account_id) ?? 0) < 0.01)
    .map((a) => accountIdByPlaid.get(a.account_id))
    .filter(Boolean) as string[];
  const waiting = dbAccounts.filter(
    (a) => a.type === "investment" && !itemized.has(a.plaidAccountId) && Math.abs(balanceByPlaid.get(a.plaidAccountId) ?? 0) >= 0.01
  );
  console.info(
    `Investments: ${itemized.size} account(s) itemized, ${rows.length} holdings` +
      (waiting.length ? `; ${waiting.length} funded account(s) returned no holdings (kept previous data)` : "")
  );

  await db.$transaction([
    db.holding.deleteMany({ where: { accountId: { in: replaceAccounts } } }),
    db.holding.createMany({ data: rows }),
  ]);

  // Nothing itemized at all for a funded brokerage: ask Plaid to re-fetch now (it
  // sends HOLDINGS: DEFAULT_UPDATE when done, which triggers another sync).
  if (itemized.size === 0 && waiting.length > 0) {
    await plaidClient.investmentsRefresh({ access_token: accessToken }).catch(() => {});
  }

  // Investment activity (buys, sells, dividends), paginated
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 24);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  let offset = 0;
  for (;;) {
    const res = await plaidClient.investmentsTransactionsGet({
      access_token: accessToken,
      start_date: fmt(start),
      end_date: fmt(end),
      options: { count: 500, offset },
    });
    const moreSecurities = await upsertSecurities(res.data.securities);
    for (const [k, v] of moreSecurities) securityIds.set(k, v);

    for (const t of res.data.investment_transactions) {
      const accountId = accountIdByPlaid.get(t.account_id);
      if (!accountId) continue;
      const data = {
        accountId,
        securityId: t.security_id ? securityIds.get(t.security_id) ?? null : null,
        date: new Date(t.date),
        name: t.name,
        type: String(t.type),
        subtype: String(t.subtype),
        quantity: t.quantity,
        price: t.price,
        amount: t.amount,
        fees: t.fees,
      };
      await db.investmentTransaction.upsert({
        where: { plaidInvestmentId: t.investment_transaction_id },
        create: { plaidInvestmentId: t.investment_transaction_id, ...data },
        update: data,
      });
    }

    offset += res.data.investment_transactions.length;
    if (res.data.investment_transactions.length === 0 || offset >= res.data.total_investment_transactions) break;
  }

  return itemized.size === 0 && waiting.length > 0 ? "pending" : "synced";
}

/** Daily portfolio value point for the performance chart. */
export async function recordPortfolioSnapshot() {
  const holdings = await db.holding.findMany({ select: { institutionValue: true, costBasis: true } });
  // Same total the Investments page shows: itemized holdings + balances of accounts without holdings detail
  const unitemized = await db.account.findMany({
    where: { type: "investment", holdings: { none: {} }, bankItem: { NOT: { itemId: { startsWith: "mock_bank" } } } },
    select: { currentBalance: true },
  });
  if (holdings.length === 0 && unitemized.length === 0) return;
  const totalValue = roundMoney(
    holdings.reduce((s, h) => s + h.institutionValue, 0) + unitemized.reduce((s, a) => s + a.currentBalance, 0)
  );
  const totalCost = roundMoney(holdings.reduce((s, h) => s + (h.costBasis ?? 0), 0));
  const date = appTodayDate();
  await db.portfolioSnapshot.upsert({
    where: { date },
    create: { date, totalValue, totalCost },
    update: { totalValue, totalCost },
  });
}
