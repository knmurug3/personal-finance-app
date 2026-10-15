import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/apiError";
import { requireAuth } from "@/lib/requireAuth";
import { analyzeCreditCardRewards } from "@/lib/rewards";

export const dynamic = "force-dynamic";

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const accounts = await db.account.findMany({
      where: { type: "credit" },
    });

    const analysis = analyzeCreditCardRewards(accounts);
    return NextResponse.json(analysis);
  } catch (error) {
    return apiError("Internal server error", error);
  }
}
