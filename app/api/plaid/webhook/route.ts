import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { isPlaidConfigured } from "@/lib/plaid";
import { verifyPlaidWebhook } from "@/lib/plaidWebhook";
import { syncBankItems } from "@/lib/syncEngine";
import { notifySyncResult, sendPushToAll } from "@/lib/push";
import { reportError, errorText } from "@/lib/errorReport";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TRANSACTION_CODES = new Set([
  "SYNC_UPDATES_AVAILABLE",
  "DEFAULT_UPDATE",
  "INITIAL_UPDATE",
  "HISTORICAL_UPDATE",
  "TRANSACTIONS_REMOVED",
]);

/**
 * Receives Plaid webhooks (set PLAID_WEBHOOK_URL to this route's public URL).
 * Authenticated by Plaid's signed JWT, not the session cookie.
 */
export async function POST(req: Request) {
  if (!isPlaidConfigured) return NextResponse.json({ error: "Plaid not configured" }, { status: 503 });

  const rawBody = await req.text();
  const valid = await verifyPlaidWebhook(rawBody, req.headers.get("plaid-verification")).catch(() => false);
  if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  let event: { webhook_type?: string; webhook_code?: string; item_id?: string; error?: { error_code?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { webhook_type: type, webhook_code: code, item_id: itemId } = event;
  if (!itemId) return NextResponse.json({ received: true });

  const isInvestmentsUpdate = (type === "HOLDINGS" || type === "INVESTMENTS_TRANSACTIONS") && code === "DEFAULT_UPDATE";
  if ((type === "TRANSACTIONS" && code && TRANSACTION_CODES.has(code)) || isInvestmentsUpdate) {
    // Acknowledge immediately; Plaid retries slow responses
    after(async () => {
      try {
        const result = await syncBankItems({ plaidItemId: itemId });
        await notifySyncResult(result);
      } catch (err) {
        console.error("Webhook-triggered sync failed:", err);
        await reportError({ source: "Plaid webhook", message: errorText(err) });
      }
    });
  } else if (type === "ITEM") {
    const needsLogin =
      (code === "ERROR" && event.error?.error_code === "ITEM_LOGIN_REQUIRED") ||
      code === "PENDING_EXPIRATION" ||
      code === "PENDING_DISCONNECT";

    if (needsLogin) {
      const item = await db.bankItem.update({ where: { itemId }, data: { status: "item_login_required" } }).catch(() => null);
      if (item) {
        after(() =>
          sendPushToAll({
            title: `Reconnect ${item.institutionName}`,
            body: "Your bank needs you to sign in again to keep syncing.",
            url: "/?tab=accounts",
          }).catch(() => {})
        );
      }
    } else if (code === "LOGIN_REPAIRED") {
      await db.bankItem.update({ where: { itemId }, data: { status: "active" } }).catch(() => {});
    } else if (code === "NEW_ACCOUNTS_AVAILABLE") {
      // The bank has accounts the owner hasn't shared yet; "choose accounts" (Link update mode) adds them
      const item = await db.bankItem.findUnique({ where: { itemId } }).catch(() => null);
      if (item) {
        after(() =>
          sendPushToAll({
            title: `New accounts at ${item.institutionName}`,
            body: "Choose which ones to add to Personal Finance.",
            url: "/?tab=accounts",
          }).catch(() => {})
        );
      }
    } else if (code === "USER_PERMISSION_REVOKED" || code === "USER_ACCOUNT_REVOKED") {
      // Access was revoked at the bank or on my.plaid.com; this connection can't sync again
      const item = await db.bankItem.update({ where: { itemId }, data: { status: "disconnected" } }).catch(() => null);
      if (item) {
        after(() =>
          sendPushToAll({
            title: `${item.institutionName} disconnected`,
            body: "Access was revoked. Connect the bank again to keep syncing.",
            url: "/?tab=accounts",
          }).catch(() => {})
        );
      }
    }
  }

  return NextResponse.json({ received: true });
}
