import { NextResponse } from "next/server";
import { CountryCode, Products } from "plaid";
import { isPlaidConfigured, plaidClient } from "@/lib/plaid";
import { apiError } from "@/lib/apiError";
import { db } from "@/lib/db";
import { plaidAccessToken } from "@/lib/plaidToken";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    if (!isPlaidConfigured) {
      return NextResponse.json(
        { error: "Plaid credentials are not configured in .env.local" },
        { status: 400 }
      );
    }

    // Optional { bankItemId } switches Link into update mode, which repairs an
    // existing connection (expired login, new MFA) instead of creating a duplicate.
    // { bankItemId, addInvestments: true } asks an existing bank for investments consent.
    // { bankItemId, selectAccounts: true } reopens the institution's account picker so more accounts can be shared.
    const { bankItemId, addInvestments, selectAccounts } = await req
      .json()
      .catch(() => ({} as { bankItemId?: string; addInvestments?: boolean; selectAccounts?: boolean }));

    let accessToken: string | undefined;
    if (bankItemId !== undefined) {
      if (typeof bankItemId !== "string") {
        return NextResponse.json({ error: "Invalid bankItemId" }, { status: 400 });
      }
      const item = await db.bankItem.findUnique({ where: { id: bankItemId } });
      if (!item) return NextResponse.json({ error: "Bank connection not found" }, { status: 404 });
      accessToken = await plaidAccessToken(item);
    }

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: "owner" },
      client_name: "Personal Finance",
      country_codes: [CountryCode.Us],
      language: "en",
      ...(process.env.PLAID_WEBHOOK_URL ? { webhook: process.env.PLAID_WEBHOOK_URL } : {}),
      ...(accessToken
        ? {
            access_token: accessToken,
            ...(addInvestments ? { additional_consented_products: [Products.Investments] } : {}),
            ...(selectAccounts ? { update: { account_selection_enabled: true } } : {}),
          }
        : {
            products: [Products.Transactions],
            // Brokerages also share holdings; banks without it still link
            required_if_supported_products: [Products.Investments],
          }),
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    return apiError("Failed to create link token", error);
  }
}
