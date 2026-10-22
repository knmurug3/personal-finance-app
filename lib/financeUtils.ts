/**
 * lib/financeUtils.ts
 * Shared finance calculation utilities used by both dashboard and insights APIs.
 * Centralizing these fixes MED-02/03 (inconsistent income/spending logic across routes).
 */

import { isPendingMatch } from "./pendingMatch";

export const TRANSFER_CATEGORIES = ["Transfers", "Transfer", "Investments", "Investment"];

const DEFAULT_TRANSFER_NAME_PATTERNS = [
  "you sold",
  "you bought",
  "reinvestment",
  "core account",
  "wire transfer",
  "funds transfer",
];

/**
 * Extra name fragments (comma-separated, e.g. specific fund tickers) that
 * should be treated as transfers. Configure via TRANSFER_NAME_PATTERNS.
 */
function transferNamePatterns(): string[] {
  const extra = (process.env.TRANSFER_NAME_PATTERNS || "")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  return [...DEFAULT_TRANSFER_NAME_PATTERNS, ...extra];
}

export function isTransfer(category: string, name?: string): boolean {
  const cat = (category || "").toLowerCase();
  if (cat === "investments" || cat === "investment" || cat.includes("transfer")) {
    return true;
  }
  if (name) {
    const lowerName = name.toLowerCase();
    return transferNamePatterns().some((p) => lowerName.includes(p));
  }
  return false;
}

/**
 * Returns true if a transaction represents income.
 * Single source of truth used by both /api/dashboard and /api/insights.
 *
 * Logic:
 * - Category === "Income" is the primary signal (set by Plaid or user override)
 * - Secondary: negative amounts (money INTO account) whose name matches payroll/salary/direct deposit/dividend
 */
export function isIncomeTransaction(tx: {
  category: string;
  amount: number;
  name: string;
}): boolean {
  if (tx.category === "Income") return true;
  if (
    tx.amount < 0 &&
    (tx.name.toLowerCase().includes("payroll") ||
      tx.name.toLowerCase().includes("salary") ||
      tx.name.toLowerCase().includes("direct deposit") ||
      tx.name.toLowerCase().includes("dividend received") ||
      tx.name.toLowerCase().includes("interest earned"))
  ) {
    return true;
  }
  return false;
}

/**
 * Signed income contribution of an income transaction: money in (negative amount) adds,
 * a positive amount (reversal / mis-categorised charge) subtracts.
 */
export function getIncomeAmount(tx: { amount: number }): number {
  return -tx.amount;
}

/**
 * Returns true if a transaction is an expense (not income, not a transfer).
 */
export function isExpenseTransaction(tx: {
  category: string;
  amount: number;
  name: string;
}): boolean {
  if (isTransfer(tx.category, tx.name)) return false;
  if (isIncomeTransaction(tx)) return false;
  return true;
}

/**
 * Computes the net spending contribution of an expense transaction.
 * Positive amounts = spending. Negative amounts = refunds/credits (reduce spending).
 */
export function getSpendingAmount(tx: { amount: number }): number {
  return tx.amount; // positive = expense, negative = refund
}

/**
 * Returns the ids of pending transactions that have a posted counterpart
 * (same purchase, tip adjustment, or $0 pre-auth hold). Matching is one-to-one, so two
 * identical purchases a few days apart (daily coffee, transit fares) don't hide each other.
 */
export function findDuplicatePendingIds<
  T extends {
    id: string;
    accountId: string;
    amount: number;
    date: Date | string;
    name?: string | null;
    merchantName?: string | null;
    pending?: boolean;
  }
>(transactions: T[]): Set<string> {
  const posted = transactions.filter((t) => !t.pending);
  const time = (t: T) => new Date(t.date).getTime();
  const pairs: { pending: T; posted: T; gap: number }[] = [];
  for (const t of transactions) {
    if (!t.pending) continue;
    for (const p of posted) {
      if (isPendingMatch(t, p)) pairs.push({ pending: t, posted: p, gap: Math.abs(time(p) - time(t)) });
    }
  }
  // Closest pairs claim each other first
  pairs.sort((a, b) => a.gap - b.gap);
  const used = new Set<string>();
  const ids = new Set<string>();
  for (const { pending, posted: p } of pairs) {
    if (ids.has(pending.id) || used.has(p.id)) continue;
    used.add(p.id);
    ids.add(pending.id);
  }
  return ids;
}

/**
 * Removes pending transactions that have a matching posted transaction.
 * Prevents double-counting in calculations and redundant items in the feed.
 */
export function deduplicatePendingTransactions<
  T extends {
    id: string;
    accountId: string;
    amount: number;
    date: Date | string;
    name?: string | null;
    merchantName?: string | null;
    pending?: boolean;
  }
>(transactions: T[]): T[] {
  const dupes = findDuplicatePendingIds(transactions);
  return transactions.filter((t) => !dupes.has(t.id));
}

/**
 * Category portions of a transaction. A split transaction contributes each split to
 * its own category (with the transaction's sign); unsplit — or splits that don't add
 * up to the transaction — fall back to the transaction's own category.
 */
export function categoryParts(tx: {
  category: string;
  amount: number;
  splits?: { category: string; amount: number }[] | null;
}): { category: string; amount: number }[] {
  const splits = tx.splits ?? [];
  if (splits.length > 0) {
    const total = splits.reduce((s, x) => s + Math.abs(x.amount), 0);
    if (Math.abs(total - Math.abs(tx.amount)) < 0.01) {
      const sign = tx.amount < 0 ? -1 : 1;
      return splits.map((x) => ({ category: x.category, amount: sign * Math.abs(x.amount) }));
    }
  }
  return [{ category: tx.category, amount: tx.amount }];
}
