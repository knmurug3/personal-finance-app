import { NextResponse } from "next/server";
import { apiError } from "@/lib/apiError";
import { requireAuth } from "@/lib/requireAuth";
import { syncBankItems } from "@/lib/syncEngine";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { newTransactions, ...result } = await syncBankItems();
    return NextResponse.json(result);
  } catch (error) {
    return apiError("Failed to sync bank accounts", error);
  }
}
