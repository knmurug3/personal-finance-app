import { createHash } from "crypto";
import { db } from "@/lib/db";
import { sendPushToAll } from "@/lib/push";

/**
 * Records an error and alerts the owner: a push the first time a problem appears,
 * then at most every ALERT_EVERY_MS while it keeps happening. Never throws.
 */
const ALERT_EVERY_MS = 6 * 60 * 60 * 1000;

/** Same problem, different ids/amounts/timestamps → same fingerprint. */
export function errorFingerprint(source: string, message: string): string {
  const normalized = message
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/g, "<uuid>")
    .replace(/\b[a-z0-9]{20,}\b/g, "<id>")
    .replace(/\d+/g, "<n>")
    .slice(0, 300);
  return createHash("sha1").update(`${source}|${normalized}`).digest("hex");
}

export async function reportError(input: { source: string; message: string; path?: string }) {
  try {
    const message = input.message.slice(0, 500) || "Unknown error";
    const source = input.source.slice(0, 60);
    const fingerprint = errorFingerprint(source, message);
    const event = await db.errorEvent.upsert({
      where: { fingerprint },
      create: { fingerprint, source, message, path: input.path?.slice(0, 200) },
      update: { count: { increment: 1 }, message, path: input.path?.slice(0, 200) },
    });
    const due = !event.lastAlertedAt || Date.now() - event.lastAlertedAt.getTime() > ALERT_EVERY_MS;
    if (!due) return;
    await db.errorEvent.update({ where: { id: event.id }, data: { lastAlertedAt: new Date() } });
    await sendPushToAll({
      title: event.count > 1 ? `Still failing: ${source}` : `Problem: ${source}`,
      body: `${message.slice(0, 140)}${event.count > 1 ? ` (${event.count}×)` : ""}`,
      url: "/?tab=accounts",
    });
  } catch (err) {
    console.error("reportError failed:", err);
  }
}

/** Error text without stack traces or secrets-bearing URLs. */
export function errorText(err: unknown): string {
  const anyErr = err as any;
  const plaidCode = anyErr?.response?.data?.error_code;
  if (plaidCode) return `Plaid ${plaidCode}`;
  if (err instanceof Error) return err.message.split("\n")[0].replace(/https?:\/\/\S+/g, "<url>");
  return String(err).slice(0, 300);
}
