/**
 * Shared helpers for reconciling Plaid transactions with stored rows
 * (pending -> posted transitions) used by /api/plaid/sync and /api/plaid/exchange-public-token.
 */

import { isPendingMatch } from "./pendingMatch";

// Whole words only: "rent" must not catch Parent, Current or Torrent, nor a rental car
const RENT_NAME = /\b(rent(?!\s*a\s*car)|housing)\b/;

/**
 * Rent paid at the end of a month is for the next one: dates on/after the 26th move to the 1st.
 * Dates are calendar days at UTC midnight, so this works in UTC regardless of server zone.
 */
export function normalizeTransactionDate(txName: string, category: string, rawDate: Date): Date {
  if (RENT_NAME.test(txName.toLowerCase()) || category.toLowerCase().includes("housing")) {
    if (rawDate.getUTCDate() >= 26) {
      return new Date(Date.UTC(rawDate.getUTCFullYear(), rawDate.getUTCMonth() + 1, 1));
    }
  }
  return rawDate;
}

interface StoredTx {
  id: string;
  accountId: string;
  amount: number;
  date: Date;
  name: string;
  merchantName: string | null;
  pending: boolean;
  plaidTransactionId: string | null;
}

/**
 * Finds the stored row a Plaid transaction corresponds to:
 * exact id, then pending_transaction_id, then a proximity match for posted
 * transactions replacing a pending one (same merchant, or exact amount).
 */
export function findExistingTransaction<T extends StoredTx>(
  tx: any,
  accountDbId: string,
  existingMap: Map<string, T>,
  existingTxs: T[],
  matchedDbIds: Set<string>
): T | undefined {
  let existing = existingMap.get(tx.transaction_id);
  if (!existing && tx.pending_transaction_id) existing = existingMap.get(tx.pending_transaction_id);
  if (existing || tx.pending) return existing;

  const posted = {
    accountId: accountDbId,
    amount: tx.amount as number,
    date: tx.date as string,
    name: tx.name as string,
    merchantName: (tx.merchant_name ?? null) as string | null,
  };
  return existingTxs.find(
    (etx) => etx.pending && !matchedDbIds.has(etx.id) && isPendingMatch(etx, posted)
  );
}
