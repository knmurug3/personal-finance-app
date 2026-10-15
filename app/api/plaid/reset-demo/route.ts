import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/apiError";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

export async function POST() {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    // Only touch transactions that belong to mock banks
    await db.transaction.deleteMany({
      where: {
        account: { bankItem: { itemId: { startsWith: "mock_bank" } } },
        OR: [
          { plaidTransactionId: { startsWith: "tx_" } },
          { plaidTransactionId: { startsWith: "mock_" } },
        ],
      },
    });

    const mockItems = await db.bankItem.findMany({
      where: { itemId: { startsWith: "mock_bank" } },
    });

    for (const item of mockItems) {
      await db.bankItem.delete({
        where: { id: item.id },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Cleared placeholder demo bank accounts and sample charges.",
    });
  } catch (error) {
    return apiError("Failed to reset demo data", error);
  }
}
