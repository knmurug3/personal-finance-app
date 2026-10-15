import { db } from "@/lib/db";
import { padRange, utcMonthRange } from "@/lib/dateUtils";
import { roundMoney } from "@/lib/money";
import {
  isTransfer,
  isIncomeTransaction,
  getIncomeAmount,
  deduplicatePendingTransactions,
  categoryParts,
} from "@/lib/financeUtils";

type SpendTx = {
  category: string;
  amount: number;
  name: string;
  date: Date;
  splits?: { category: string; amount: number }[] | null;
};

/** Income and per-category spending for a set of transactions (dashboard rules). */
export function summarizeSpending(transactions: SpendTx[]) {
  let income = 0;
  const raw: Record<string, number> = {};
  for (const tx of transactions) {
    if (isTransfer(tx.category, tx.name)) continue;
    if (isIncomeTransaction(tx)) {
      income += getIncomeAmount(tx);
    } else {
      // Positive = expense, negative = refund; split charges count per split category
      for (const part of categoryParts(tx)) raw[part.category] = (raw[part.category] || 0) + part.amount;
    }
  }
  // Refunds can't push a category below zero; the total is the sum of clamped categories
  const categorySpending: Record<string, number> = {};
  let expenses = 0;
  for (const [cat, v] of Object.entries(raw)) {
    categorySpending[cat] = roundMoney(Math.max(0, v));
    expenses += categorySpending[cat];
  }
  return { categorySpending, income: roundMoney(Math.max(0, income)), expenses: roundMoney(expenses) };
}

/** Deduplicated transactions (with splits) inside [gte, lt). */
export async function loadTransactions(range: { gte: Date; lt: Date }) {
  const raw = await db.transaction.findMany({
    where: { date: padRange(range) },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    include: { splits: { select: { category: true, amount: true } } },
  });
  return deduplicatePendingTransactions(raw).filter((tx) => tx.date >= range.gte && tx.date < range.lt);
}

type BudgetRow = {
  id: string;
  category: string;
  emoji: string | null;
  monthlyLimit: number;
  rollover: boolean;
  rolloverSince: Date | null;
};

const monthStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

/**
 * Rollover balance per category at `periodStart`: the sum of (limit − spent) for every
 * full month from the budget's rolloverSince up to (not including) periodStart.
 */
export async function rolloverCarry(budgets: BudgetRow[], periodStart: Date): Promise<Map<string, number>> {
  const carry = new Map<string, number>();
  const rolling = budgets.filter((b) => b.rollover && b.rolloverSince && monthStart(b.rolloverSince) < periodStart);
  if (rolling.length === 0) return carry;

  const earliest = new Date(Math.min(...rolling.map((b) => monthStart(b.rolloverSince!).getTime())));
  const txs = await loadTransactions({ gte: earliest, lt: periodStart });

  // Spending per month per category
  const byMonth = new Map<string, SpendTx[]>();
  for (const tx of txs) {
    const key = `${tx.date.getUTCFullYear()}-${tx.date.getUTCMonth()}`;
    (byMonth.get(key) ?? byMonth.set(key, []).get(key)!).push(tx);
  }

  for (const b of rolling) {
    let total = 0;
    for (let m = monthStart(b.rolloverSince!); m < periodStart; m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1))) {
      const spent = summarizeSpending(byMonth.get(`${m.getUTCFullYear()}-${m.getUTCMonth()}`) ?? []).categorySpending[b.category] ?? 0;
      total += b.monthlyLimit - spent;
    }
    carry.set(b.category, roundMoney(total));
  }
  return carry;
}

export function buildBudgetProgress(
  budgets: BudgetRow[],
  categorySpending: Record<string, number>,
  carry: Map<string, number> = new Map()
) {
  return budgets
    .filter((b) => b.category !== "Transfers" && b.category !== "Investments")
    .map((b) => {
      const spent = Math.max(0, categorySpending[b.category] || 0);
      const rolloverAmount = b.rollover ? carry.get(b.category) ?? 0 : 0;
      // Overspending can carry the available amount below zero; percentages use what's available
      const effectiveLimit = roundMoney(b.monthlyLimit + rolloverAmount);
      const basis = Math.max(effectiveLimit, 0);
      const rawPct = basis > 0 ? Math.round((spent / basis) * 100) : spent > 0 ? 100 : 0;
      return {
        id: b.id,
        category: b.category,
        emoji: b.emoji || "📦",
        monthlyLimit: b.monthlyLimit,
        rollover: b.rollover,
        rolloverAmount,
        effectiveLimit,
        spent: roundMoney(spent),
        remaining: roundMoney(effectiveLimit - spent),
        percentage: Math.min(rawPct, 100),
        rawPercentage: rawPct,
        isOver: spent > basis && (basis > 0 || spent > 0),
      };
    });
}

/** Budget progress for one calendar month (rollover-aware). */
export async function monthBudgetProgress(year: number, month0: number) {
  const range = utcMonthRange(year, month0);
  const [txs, budgets] = await Promise.all([loadTransactions(range), db.budget.findMany()]);
  const summary = summarizeSpending(txs);
  const carry = await rolloverCarry(budgets, range.gte);
  return { range, ...summary, progress: buildBudgetProgress(budgets, summary.categorySpending, carry) };
}
