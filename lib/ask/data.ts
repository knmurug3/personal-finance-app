import { db } from "@/lib/db";
import { deduplicatePendingTransactions } from "@/lib/financeUtils";
import { buildPortfolio, type Portfolio } from "@/lib/portfolio";
import {
  DEMO_ACCOUNTS,
  DEMO_TRANSACTIONS,
  DEMO_DASHBOARD,
  DEMO_SUBSCRIPTIONS,
  DEMO_INVESTMENTS,
  DEMO_NETWORTH_HISTORY,
} from "@/lib/demoData";

export interface AskTransaction {
  date: Date;
  amount: number; // Plaid convention: positive = money out
  name: string;
  merchant: string | null;
  category: string;
  account: string;
  pending: boolean;
  splits?: { category: string; amount: number }[];
}

export interface AskSnapshot {
  transactions: AskTransaction[];
  accounts: { name: string; institution: string; type: string; subtype: string | null; mask: string | null; balance: number }[];
  manualAccounts: { name: string; type: string; balance: number }[];
  budgets: { category: string; monthlyLimit: number }[];
  subscriptions: { name: string; amount: number; frequency: string; nextDueDate: string; category: string }[];
  portfolio: Portfolio | null;
  netWorthHistory: { date: string; netWorth: number }[];
}

const HISTORY_MONTHS = 24;

/** Everything the assistant's tools may read — the owner's data, or the demo profile. */
export async function loadSnapshot(demo: boolean): Promise<AskSnapshot> {
  if (demo) {
    return {
      transactions: DEMO_TRANSACTIONS.map((t: any) => ({
        date: new Date(t.date),
        amount: t.amount,
        name: t.name,
        merchant: t.merchantName ?? null,
        category: t.category,
        account: t.account?.name ?? "Account",
        pending: Boolean(t.pending),
      })),
      accounts: DEMO_ACCOUNTS.map((a: any) => ({
        name: a.name,
        institution: a.institutionName,
        type: a.type,
        subtype: a.subtype ?? null,
        mask: a.mask ?? null,
        balance: a.currentBalance,
      })),
      manualAccounts: [],
      budgets: DEMO_DASHBOARD.budgetProgress.map((b) => ({ category: b.category, monthlyLimit: b.monthlyLimit })),
      subscriptions: DEMO_SUBSCRIPTIONS.subscriptions.map((s: any) => ({
        name: s.name,
        amount: s.amount,
        frequency: s.frequency,
        nextDueDate: String(s.nextDueDate).split("T")[0],
        category: s.category,
      })),
      portfolio: DEMO_INVESTMENTS,
      netWorthHistory: DEMO_NETWORTH_HISTORY.map((h: any) => ({ date: h.date, netWorth: h.NetWorth })),
    };
  }

  const since = new Date();
  since.setMonth(since.getMonth() - HISTORY_MONTHS);

  const [rawTx, accounts, manualAccounts, budgets, subscriptions, holdings, investmentAccounts, snapshots] = await Promise.all([
    db.transaction.findMany({
      where: { date: { gte: since } },
      orderBy: { date: "desc" },
      include: { account: { select: { name: true } }, splits: { select: { category: true, amount: true } } },
    }),
    db.account.findMany({ include: { bankItem: { select: { institutionName: true } } } }),
    db.manualAccount.findMany(),
    db.budget.findMany(),
    db.subscription.findMany({ where: { status: "active" } }),
    db.holding.findMany({ include: { security: true, account: { include: { bankItem: true } } } }).catch(() => []),
    db.account
      .findMany({ where: { type: "investment" }, include: { bankItem: true, _count: { select: { holdings: true } } } })
      .catch(() => []),
    db.netWorthSnapshot.findMany({ orderBy: { date: "asc" }, take: 365 }),
  ]);

  const transactions = deduplicatePendingTransactions(rawTx).map((t) => ({
    date: t.date,
    amount: t.amount,
    name: t.name,
    merchant: t.merchantName,
    category: t.category,
    account: t.account.name,
    pending: t.pending,
    splits: t.splits,
  }));

  const portfolio =
    holdings.length || investmentAccounts.length
      ? buildPortfolio(
          holdings.map((h) => ({
            quantity: h.quantity,
            costBasis: h.costBasis,
            institutionPrice: h.institutionPrice,
            institutionValue: h.institutionValue,
            account: { name: h.account.name, mask: h.account.mask, institution: h.account.bankItem.institutionName },
            security: {
              id: h.security.id,
              ticker: h.security.ticker,
              name: h.security.name,
              type: h.security.type,
              isCashEquivalent: h.security.isCashEquivalent,
            },
          })),
          investmentAccounts
            .filter((a) => a._count.holdings === 0 && Math.abs(a.currentBalance) >= 0.01)
            .map((a) => ({ institution: a.bankItem.institutionName, account: a.name, value: a.currentBalance }))
        )
      : null;

  return {
    transactions,
    accounts: accounts.map((a) => ({
      name: a.name,
      institution: a.bankItem.institutionName,
      type: a.type,
      subtype: a.subtype,
      mask: a.mask,
      balance: a.currentBalance,
    })),
    manualAccounts: manualAccounts.map((m) => ({ name: m.name, type: m.type, balance: m.balance })),
    budgets: budgets
      .filter((b) => b.category !== "Transfers" && b.category !== "Investments")
      .map((b) => ({ category: b.category, monthlyLimit: b.monthlyLimit })),
    subscriptions: subscriptions.map((s) => ({
      name: s.name,
      amount: s.amount,
      frequency: s.frequency,
      nextDueDate: s.nextDueDate.toISOString().split("T")[0],
      category: s.category,
    })),
    portfolio,
    netWorthHistory: snapshots.map((s) => ({ date: s.date.toISOString().split("T")[0], netWorth: s.netWorth })),
  };
}
