/**
 * Single source of truth for deciding whether a pending transaction and a
 * posted transaction are the same purchase. Used by the Plaid sync routes
 * (to reconcile stored rows) and by financeUtils (to hide duplicates in the UI).
 */

export const PENDING_MATCH_WINDOW_DAYS = 5;
const STOP_WORDS = ["aplpay", "payment", "store", "online"];
const DAY_MS = 86_400_000;

export interface MatchableTx {
  accountId: string;
  amount: number;
  date: Date | string;
  name?: string | null;
  merchantName?: string | null;
}

export function merchantKeywords(...parts: (string | null | undefined)[]): string[] {
  return parts
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.includes(w));
}

export function isPendingMatch(pending: MatchableTx, posted: MatchableTx): boolean {
  if (pending.accountId !== posted.accountId) return false;
  // A charge posts on or after it was authorised (a day of slack for banks that backdate)
  const lag = (new Date(posted.date).getTime() - new Date(pending.date).getTime()) / DAY_MS;
  if (lag < -1 || lag > PENDING_MATCH_WINDOW_DAYS) return false;
  const daysDiff = Math.abs(lag);

  const pTokens = merchantKeywords(pending.name, pending.merchantName);
  const qTokens = merchantKeywords(posted.name, posted.merchantName);
  const exactAmount = Math.abs(pending.amount - posted.amount) < 0.01;

  // Names too short to compare: only trust an exact amount within two days
  if (pTokens.length === 0 || qTokens.length === 0) return exactAmount && daysDiff <= 2;

  if (!pTokens.some((t) => qTokens.includes(t))) return false;
  if (exactAmount) return true;
  // Restaurant tip adjustment (pending authorised before tip, posted up to +35%)
  if (pending.amount > 0 && posted.amount >= pending.amount && posted.amount <= pending.amount * 1.35) return true;
  // $0 pre-authorisation hold (gas pump, card verification)
  return pending.amount === 0;
}
