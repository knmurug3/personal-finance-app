import { NextResponse } from "next/server";
import { isPlaidConfigured, plaidClient } from "@/lib/plaid";
import { syncBankItems } from "@/lib/syncEngine";
import { db } from "@/lib/db";
import { apiError } from "@/lib/apiError";
import { requireAuth } from "@/lib/requireAuth";
import { encrypt } from "@/lib/encryption";
import { cleanString } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { publicToken, institutionName } = await req.json();

    if (typeof publicToken !== "string" || !publicToken) {
      return NextResponse.json({ error: "publicToken is required." }, { status: 400 });
    }

    if (!isPlaidConfigured) {
      return NextResponse.json(
        { error: "Plaid credentials are not configured in .env.local" },
        { status: 400 }
      );
    }

    const bankName = cleanString(institutionName, 100);

    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const rawAccessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Encrypt access token before storing (HIGH-02 fix)
    const encryptedAccessToken = encrypt(rawAccessToken);

    const bankItem = await db.bankItem.upsert({
      where: { itemId },
      update: { accessToken: encryptedAccessToken, status: "active" },
      create: {
        itemId,
        accessToken: encryptedAccessToken,
        institutionName: bankName || "Connected Bank",
        status: "active",
      },
    });

    const accountsResponse = await plaidClient.accountsGet({
      access_token: rawAccessToken,
    });

    const createdAccounts = [];
    for (const acc of accountsResponse.data.accounts) {
      const created = await db.account.upsert({
        where: { plaidAccountId: acc.account_id },
        update: {
          currentBalance: acc.balances.current ?? 0,
          availableBalance: acc.balances.available ?? acc.balances.current ?? 0,
        },
        create: {
          bankItemId: bankItem.id,
          plaidAccountId: acc.account_id,
          name: acc.name,
          officialName: acc.official_name || acc.name,
          type: acc.type,
          subtype: acc.subtype,
          mask: acc.mask || undefined,
          currentBalance: acc.balances.current ?? 0,
          availableBalance: acc.balances.available ?? acc.balances.current ?? 0,
          isoCurrencyCode: acc.balances.iso_currency_code || "USD",
        },
      });
      createdAccounts.push(created);
    }

    // First import uses the shared incremental sync (cursor starts empty = full history),
    // so category rules, pending matching and investments all behave like every later sync.
    const result = await syncBankItems({ plaidItemId: itemId });

    return NextResponse.json({
      success: true,
      message: `Connected ${bankName || "bank"}`,
      accountsCount: createdAccounts.length,
      syncedTransactionsCount: result.syncedTransactionsCount,
    });
  } catch (error) {
    return apiError("Failed to connect bank account", error);
  }
}
