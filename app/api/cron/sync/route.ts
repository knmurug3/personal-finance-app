import { NextResponse } from "next/server";
import * as crypto from "crypto";
import { apiError } from "@/lib/apiError";
import { syncBankItems } from "@/lib/syncEngine";
import { notifySyncResult } from "@/lib/push";
import { recordNetWorthSnapshot } from "@/lib/netWorth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scheduled background sync (see `crons` in vercel.json).
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` with every cron invocation.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(req.headers.get("authorization") || "");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncBankItems();
    // Record a daily net worth point even on days the app isn't opened
    await recordNetWorthSnapshot().catch((err) => console.error("Snapshot failed:", err));
    await notifySyncResult(result).catch((err) => console.error("Sync notification failed:", err));
    const { newTransactions, ...summary } = result;
    return NextResponse.json(summary);
  } catch (error) {
    return apiError("Scheduled sync failed", error);
  }
}
