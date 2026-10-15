import { db } from "./db";
import { deduplicatePendingTransactions, isTransfer } from "./financeUtils";

/**
 * Finds recurring bills in transaction history and keeps auto-detected
 * subscriptions in sync. User-added subscriptions (source "manual") are never
 * modified; dismissed ones are never resurrected.
 */

const KNOWN_SUBSCRIPTION_KEYWORDS = [
  "anthropic", "claude", "openai", "chatgpt", "hulu", "netflix", "spotify", "disney",
  "gym", "fitness", "utility", "electric", "rent",
  "insurance", "youtube", "icloud", "apple.com/bill", "amazon prime",
  "nytimes", "wsj",
];

// Everyday spending that happens to be roughly monthly is not a subscription
const NON_SUBSCRIPTION_CATEGORIES = new Set([
  "Grocery", "Food & Dining", "Transport", "Shopping", "Income", "Transfers", "Investments", "Personal Care",
]);
const EXCLUDED_NAME_FRAGMENTS = ["payment", "transfer", "zelle", "venmo", "withdrawal", "deposit"];

const DAY = 86_400_000;
const MIN_CHARGES = 3;
const MONTHLY_GAP = { min: 25, max: 35 };
const MAX_AMOUNT_SPREAD = 0.2; // within ±20% of the median charge
const STALE_AFTER_DAYS = 45; // no charge for this long = no longer active

export const DETECTION_META_KEY = "subscriptions.detectedAt";
export const DETECTION_INTERVAL_MS = 6 * 60 * 60 * 1000;

interface Candidate {
  merchant: string;
  category: string;
  amount: number;
  nextDueDate: Date;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Pure detection over charges (exported for tests). */
export function findRecurringCharges(
  txs: { name: string; merchantName: string | null; amount: number; date: Date; category: string }[],
  now = new Date()
): Candidate[] {
  const groups = new Map<string, typeof txs>();
  for (const tx of txs) {
    if (tx.amount <= 0) continue;
    const merchant = (tx.merchantName || tx.name).trim();
    const lower = merchant.toLowerCase();
    if (!merchant || EXCLUDED_NAME_FRAGMENTS.some((f) => lower.includes(f)) || isTransfer(tx.category, tx.name)) continue;
    const list = groups.get(merchant) ?? [];
    list.push(tx);
    groups.set(merchant, list);
  }

  const out: Candidate[] = [];
  for (const [merchant, list] of groups) {
    const lower = merchant.toLowerCase();
    const known = KNOWN_SUBSCRIPTION_KEYWORDS.some((kw) => lower.includes(kw));
    list.sort((a, b) => a.date.getTime() - b.date.getTime());
    const last = list[list.length - 1];
    if (now.getTime() - last.date.getTime() > STALE_AFTER_DAYS * DAY) continue;
    if (!known && NON_SUBSCRIPTION_CATEGORIES.has(last.category)) continue;

    const recent = list.slice(-6);
    if (!known) {
      if (recent.length < MIN_CHARGES) continue;
      const gaps = recent.slice(1).map((t, i) => (t.date.getTime() - recent[i].date.getTime()) / DAY);
      if (!gaps.every((g) => g >= MONTHLY_GAP.min && g <= MONTHLY_GAP.max)) continue;
      const mid = median(recent.map((t) => t.amount));
      if (!recent.every((t) => Math.abs(t.amount - mid) <= mid * MAX_AMOUNT_SPREAD)) continue;
    }

    const next = new Date(last.date);
    do {
      next.setUTCMonth(next.getUTCMonth() + 1);
    } while (next.getTime() < now.getTime() - DAY);

    out.push({
      merchant,
      category: last.category || "Utilities",
      amount: Math.round(median(recent.map((t) => t.amount)) * 100) / 100,
      nextDueDate: next,
    });
  }
  return out;
}

export async function detectAndSyncSubscriptions(): Promise<number> {
  try {
    const rawTxs = await db.transaction.findMany({
      where: { amount: { gt: 0 }, date: { gte: new Date(Date.now() - 200 * DAY) } },
      orderBy: { date: "desc" },
    });
    const candidates = findRecurringCharges(deduplicatePendingTransactions(rawTxs));
    const existing = await db.subscription.findMany();
    const keyOf = (s: { merchantName: string | null; name: string }) => (s.merchantName || s.name).toLowerCase().trim();
    const byKey = new Map(existing.map((s) => [keyOf(s), s]));
    const seen = new Set<string>();

    for (const c of candidates) {
      const key = c.merchant.toLowerCase();
      seen.add(key);
      const sub = byKey.get(key);
      if (sub) {
        // Never resurrect dismissed bills or touch user-added ones
        if (sub.status === "dismissed" || sub.source !== "detected") continue;
        await db.subscription.update({
          where: { id: sub.id },
          data: { amount: c.amount, nextDueDate: c.nextDueDate, category: c.category, status: sub.status === "cancelled" ? "active" : sub.status },
        });
      } else {
        await db.subscription.create({
          data: {
            name: c.merchant,
            merchantName: c.merchant,
            amount: c.amount,
            frequency: "monthly",
            nextDueDate: c.nextDueDate,
            category: c.category,
            status: "active",
            source: "detected",
          },
        });
      }
    }

    // Auto-detected bills that no longer look recurring (or stopped charging) are retired
    const stale = existing.filter((s) => s.source === "detected" && s.status === "active" && !seen.has(keyOf(s)));
    if (stale.length) {
      await db.subscription.updateMany({ where: { id: { in: stale.map((s) => s.id) } }, data: { status: "cancelled" } });
    }

    await db.appMeta.upsert({
      where: { key: DETECTION_META_KEY },
      create: { key: DETECTION_META_KEY, value: new Date().toISOString() },
      update: { value: new Date().toISOString() },
    });
    return candidates.length;
  } catch (err) {
    console.error("Error in subscription detector:", err);
    return 0;
  }
}

/** Runs detection if it hasn't run within DETECTION_INTERVAL_MS. */
export async function detectSubscriptionsIfDue(): Promise<void> {
  const meta = await db.appMeta.findUnique({ where: { key: DETECTION_META_KEY } }).catch(() => null);
  if (meta && Date.now() - new Date(meta.value).getTime() < DETECTION_INTERVAL_MS) return;
  await detectAndSyncSubscriptions();
}
