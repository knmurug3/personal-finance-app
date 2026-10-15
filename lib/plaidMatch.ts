/**
 * Shared helpers for reconciling Plaid transactions with stored rows
 * (pending -> posted transitions) used by /api/plaid/sync and /api/plaid/exchange-public-token.
 */

import { isPendingMatch } from "./pendingMatch";

export function normalizeTransactionDate(txName: string, category: string, rawDate: Date): Date {
  const name = txName.toLowerCase();
  const cat = category.toLowerCase();
  if (name.includes("rent") || name.includes("housing") || cat.includes("housing")) {
    if (rawDate.getDate() >= 26) {
      return new Date(rawDate.getFullYear(), rawDate.getMonth() + 1, 1);
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
