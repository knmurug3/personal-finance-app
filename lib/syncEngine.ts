import { db } from "@/lib/db";
import { isPlaidConfigured, plaidClient, fetchTransactionChanges } from "@/lib/plaid";
import { normalizeTransactionDate, findExistingTransaction } from "@/lib/plaidMatch";
import { mapPlaidCategoryToStandard } from "@/lib/categoryMapper";
import type { CategoryRule, Prisma } from "@prisma/client";
import { plaidAccessToken } from "@/lib/plaidToken";
import { detectAndSyncSubscriptions } from "@/lib/subscriptionDetector";
import { checkBudgetAlerts } from "@/lib/budgetAlerts";
import { reportError, errorText } from "@/lib/errorReport";
import { checkForecastAlert } from "@/lib/forecastData";
import { syncInvestmentsForItem, recordPortfolioSnapshot, type InvestmentSyncStatus } from "@/lib/investmentSync";

export interface SyncResult {
  success: boolean;
  message: string;
  failedItems: string[];
  syncedItemsCount: number;
  syncedTransactionsCount: number;
  /** Bank item id → investments outcome (items without investment accounts omitted) */
  investments: Record<string, InvestmentSyncStatus>;
  /** Posted transactions created by this run (used for notifications) */
  newTransactions: { name: string; amount: number }[];
}

/**
 * Pulls balances and the last 365 days of transactions for every connected
 * bank (or a single Plaid item) and reconciles them with the database.
 * Shared by the manual sync endpoint, the scheduled cron job and Plaid webhooks.
 */
export async function syncBankItems(opts: { plaidItemId?: string } = {}): Promise<SyncResult> {
  const bankItems = await db.bankItem.findMany({
    where: opts.plaidItemId ? { itemId: opts.plaidItemId } : undefined,
    include: { accounts: true },
  });

  if (bankItems.length === 0) {
    return {
      success: true,
      message: "No bank accounts connected yet. Click Add Account to connect your live accounts.",
      failedItems: [],
      syncedItemsCount: 0,
      syncedTransactionsCount: 0,
      investments: {},
      newTransactions: [],
    };
  }

  let syncedItemsCount = 0;
  let syncedTransactionsCount = 0;
  const failedItems: string[] = [];
  const addedTransactions: { name: string; amount: number }[] = [];
  const investments: Record<string, InvestmentSyncStatus> = {};
  const categoryRules = await db.categoryRule.findMany();
  
  function applyRules(name: string, merchantName: string | null, rules: CategoryRule[]): string | null {
    const haystack = `${name} ${merchantName || ''}`.toLowerCase();
    for (const rule of rules) {
      if (haystack.includes(rule.merchantPattern.toLowerCase())) {
        return rule.category;
      }
    }
    return null;
  }

  for (const item of bankItems) {
    if (item.itemId.startsWith("mock_bank")) {
      syncedItemsCount++;
      continue;
    }

    if (!isPlaidConfigured) continue;

    try {
      // Decrypt access token for use with Plaid API (HIGH-02 fix)
      const rawAccessToken = await plaidAccessToken(item);

      const accountsResponse = await plaidClient.accountsGet({
        access_token: rawAccessToken,
      });

      // Point items linked before webhooks were configured at the webhook route
      const webhookUrl = process.env.PLAID_WEBHOOK_URL;
      if (webhookUrl && accountsResponse.data.item.webhook !== webhookUrl) {
        await plaidClient
          .itemWebhookUpdate({ access_token: rawAccessToken, webhook: webhookUrl })
          .catch((err) => console.error("Failed to register Plaid webhook:", err?.response?.data?.error_code || err));
      }

      // Upsert: accounts newly shared through Link account selection must be created, not updated
      for (const acc of accountsResponse.data.accounts) {
        const balances = {
          currentBalance: acc.balances.current ?? 0,
          availableBalance: acc.balances.available ?? acc.balances.current ?? 0,
        };
        await db.account.upsert({
          where: { plaidAccountId: acc.account_id },
          update: balances,
          create: {
            bankItemId: item.id,
            plaidAccountId: acc.account_id,
            name: acc.name,
            officialName: acc.official_name ?? null,
            type: String(acc.type),
            subtype: acc.subtype ? String(acc.subtype) : null,
            mask: acc.mask ?? null,
            isoCurrencyCode: acc.balances.iso_currency_code || "USD",
            ...balances,
          },
        });
      }

      // Incremental changes since the last sync (first run after this upgrade = full history)
      const changes = await fetchTransactionChanges(rawAccessToken, item.transactionsCursor);

      const dbAccounts = await db.account.findMany({
        where: { bankItemId: item.id },
      });
      const dbAccountIds = dbAccounts.map((a) => a.id);
      const dbAccountByPlaid = new Map(dbAccounts.map((a) => [a.plaidAccountId, a]));

      // Only load rows the changes can touch: same Plaid ids, the pending rows they may
      // replace (by pending_transaction_id or proximity match), and removed ids.
      const incoming = [...changes.added, ...changes.modified];
      const referencedIds = [
        ...incoming.map((t) => t.transaction_id),
        ...(incoming.map((t) => t.pending_transaction_id).filter(Boolean) as string[]),
      ];
      const existingTxs = await db.transaction.findMany({
        where: {
          accountId: { in: dbAccountIds },
          OR: [{ pending: true }, { plaidTransactionId: { in: referencedIds } }],
        },
      });
      const existingMap = new Map<string, typeof existingTxs[0]>();
      existingTxs.forEach((t) => {
        if (t.plaidTransactionId) existingMap.set(t.plaidTransactionId, t);
      });

      const newTransactions: Prisma.TransactionCreateManyInput[] = [];
      const updatedTransactions: { id: string; data: Prisma.TransactionUpdateInput }[] = [];
      const matchedDbIds = new Set<string>();

      for (const tx of incoming) {
        const dbAccount = dbAccountByPlaid.get(tx.account_id);
        if (!dbAccount) continue;

        const rawCategory = tx.category ? tx.category[0] : "General";
        const txMerchant = tx.merchant_name || tx.name || "";

        const existingTx = findExistingTransaction(tx, dbAccount.id, existingMap, existingTxs, matchedDbIds);

        if (existingTx) {
          matchedDbIds.add(existingTx.id);
          // Preserve all user manual edits (category, tags, reviewed, dates)
          const normalizedDate = normalizeTransactionDate(
            txMerchant,
            existingTx.category,
            existingTx.pending ? new Date(tx.date) : existingTx.date
          );
          updatedTransactions.push({
            id: existingTx.id,
            data: {
              plaidTransactionId: tx.transaction_id,
              amount: tx.amount,
              date: normalizedDate,
              name: tx.name,
              merchantName: tx.merchant_name || null,
              pending: tx.pending,
            },
          });
        } else {
          const ruleCategory = applyRules(tx.name, tx.merchant_name || null, categoryRules);
          const initialCategory = ruleCategory ? ruleCategory : mapPlaidCategoryToStandard(rawCategory, txMerchant);
          const normalizedDate = normalizeTransactionDate(txMerchant, initialCategory, new Date(tx.date));
          newTransactions.push({
            accountId: dbAccount.id,
            plaidTransactionId: tx.transaction_id,
            amount: tx.amount,
            date: normalizedDate,
            name: tx.name,
            merchantName: tx.merchant_name || null,
            category: initialCategory,
            pending: tx.pending,
          });
        }
      }

      if (newTransactions.length > 0) {
        await db.transaction.createMany({ data: newTransactions, skipDuplicates: true });
      }
      const CHUNK_SIZE = 50;
      for (let i = 0; i < updatedTransactions.length; i += CHUNK_SIZE) {
        await db.$transaction(
          updatedTransactions.slice(i, i + CHUNK_SIZE).map((u) => db.transaction.update({ where: { id: u.id }, data: u.data }))
        );
      }

      // Transactions the bank removed (reversed charges, expired holds, pending rows replaced
      // by a posted one we didn't match). Rows we just re-pointed at a new id are unaffected.
      if (changes.removed.length > 0) {
        await db.transaction.deleteMany({
          where: { accountId: { in: dbAccountIds }, plaidTransactionId: { in: changes.removed } },
        });
      }

      // Only advance the cursor once everything above is saved, so a failure retries the same changes
      await db.bankItem.update({ where: { id: item.id }, data: { transactionsCursor: changes.nextCursor } });

      // Holdings & investment activity — a failure here shouldn't fail the cash sync
      try {
        const status = await syncInvestmentsForItem(rawAccessToken, dbAccounts);
        if (status !== "no_accounts") investments[item.id] = status;
        await db.bankItem
          .update({ where: { id: item.id }, data: { investmentsStatus: status === "no_accounts" ? null : status } })
          .catch(() => {});
      } catch (err: any) {
        console.error(`Investments sync failed for ${item.id}:`, err?.response?.data?.error_code || err);
      }

      syncedTransactionsCount += newTransactions.length;
      for (const t of newTransactions) {
        if (!t.pending) addedTransactions.push({ name: t.merchantName || t.name, amount: t.amount });
      }

      await db.bankItem.update({
        where: { id: item.id },
        data: { status: "active" },
      }).catch(() => {});

      syncedItemsCount++;
    } catch (err: any) {
      console.error(`Failed to sync bank item ${item.id}:`, err?.response?.data?.error_code || err);
      failedItems.push(item.institutionName);
      await reportError({ source: "Bank sync", message: `${item.institutionName}: ${errorText(err)}` });
      // ITEM_LOGIN_REQUIRED means the user must re-authenticate via Link update mode
      const code = err?.response?.data?.error_code;
      await db.bankItem.update({
        where: { id: item.id },
        data: { status: code === "ITEM_LOGIN_REQUIRED" ? "item_login_required" : "error" },
      }).catch(() => {});
    }
  }

  await recordPortfolioSnapshot().catch((err) => console.error("Portfolio snapshot failed:", err));
  // New charges may start or end a recurring bill
  if (syncedTransactionsCount > 0) {
    await detectAndSyncSubscriptions().catch(() => {});
    await checkBudgetAlerts().catch((err) => console.error("Budget alerts failed:", err));
    await checkForecastAlert().catch((err) => console.error("Forecast alert failed:", err));
  }

  return {
    success: failedItems.length === 0,
    message:
      `Synced ${syncedItemsCount} bank connections. All user manual edits preserved.` +
      (failedItems.length ? ` Failed: ${failedItems.join(", ")}.` : ""),
    failedItems,
    syncedItemsCount,
    syncedTransactionsCount,
    investments,
    newTransactions: addedTransactions,
  };
}
