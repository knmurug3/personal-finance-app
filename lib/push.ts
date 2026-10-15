import webpush from "web-push";
import { db } from "@/lib/db";

export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
}

/** Notification links must stay inside the app: a same-origin path, never "//host" or a full URL. */
export function safePushUrl(url: unknown): string {
  return typeof url === "string" && /^\/(?![\/\\])/.test(url) && url.length <= 500 ? url : "/";
}

/** Sends a notification to every stored subscription and prunes dead ones. */
export async function sendPushToAll(payload: PushPayload) {
  if (!isPushConfigured()) return { sent: 0, failed: 0, removed: 0, configured: false };

  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const body = JSON.stringify({ title: payload.title, body: payload.body, url: safePushUrl(payload.url) });
  const subscriptions = await db.pushSubscription.findMany();

  let sent = 0;
  const expired: string[] = [];
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body);
        sent++;
      } catch (err: any) {
        // 404/410 mean the subscription is gone for good
        if (err?.statusCode === 404 || err?.statusCode === 410) expired.push(sub.endpoint);
        else console.error("Push send failed:", err?.statusCode);
      }
    })
  );

  if (expired.length > 0) {
    await db.pushSubscription.deleteMany({ where: { endpoint: { in: expired } } });
  }

  return { sent, failed: subscriptions.length - sent - expired.length, removed: expired.length, configured: true };
}

const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Math.abs(n));

/** Summarises a background sync as a single notification (no-op when nothing changed). */
export async function notifySyncResult(result: { newTransactions: { name: string; amount: number }[]; failedItems: string[] }) {
  const { newTransactions, failedItems } = result;
  if (failedItems.length > 0) {
    await sendPushToAll({
      title: "Bank connection needs attention",
      body: `${failedItems.join(", ")} couldn't sync. Open Personal Finance to reconnect.`,
      url: "/?tab=accounts",
    });
  }
  if (newTransactions.length === 0) return;
  // Plaid convention: positive = money out
  const largest = [...newTransactions].sort((a, b) => b.amount - a.amount)[0];
  const body =
    newTransactions.length === 1
      ? `${largest.name} · ${largest.amount < 0 ? "+" : "−"}${usd(largest.amount)}`
      : `Including ${largest.name} (${usd(largest.amount)}). Tap to review.`;
  await sendPushToAll({
    title: newTransactions.length === 1 ? "New transaction" : `${newTransactions.length} new transactions`,
    body,
    url: "/?tab=transactions",
  });
}
