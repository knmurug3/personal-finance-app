import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/apiError";
import { requireAuth } from "@/lib/requireAuth";
import { recordNetWorthSnapshot } from "@/lib/netWorth";

export const dynamic = "force-dynamic";

const HISTORY_DAYS = 30;

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    // Always record today's real snapshot (the daily cron does this too)
    const live = await recordNetWorthSnapshot();

    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - HISTORY_DAYS);

    // Only real snapshots — the chart shows "building history" until there are enough
    const history = await db.netWorthSnapshot.findMany({
      where: { date: { gte: cutoff } },
      orderBy: { date: "asc" },
    });

    return NextResponse.json({
      currentNetWorth: live.netWorth,
      history: history.map((h) => ({
        date: h.date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
        NetWorth: h.netWorth,
        Cash: h.totalCash,
        Investments: h.totalInvestments,
        Debt: h.totalDebt,
      })),
    });
  } catch (error) {
    return apiError("Failed to fetch net worth history", error);
  }
}
