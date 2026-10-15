import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/apiError";
import { requireAuth } from "@/lib/requireAuth";
import { buildPortfolio } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const [holdings, history, activity, investmentAccounts] = await Promise.all([
      db.holding.findMany({
        include: { security: true, account: { include: { bankItem: true } } },
      }),
      db.portfolioSnapshot.findMany({ orderBy: { date: "asc" }, take: 365 }),
      db.investmentTransaction.findMany({
        orderBy: { date: "desc" },
        take: 50,
        include: { security: { select: { ticker: true, name: true } }, account: { include: { bankItem: true } } },
      }),
      db.account.findMany({
        where: { type: "investment" },
        include: { bankItem: true, _count: { select: { holdings: true } } },
      }),
    ]);

    // Accounts Plaid shares a balance for but not holdings (e.g. not selected for investments at the brokerage)
    const unitemized = investmentAccounts
      .filter((a) => a._count.holdings === 0 && Math.abs(a.currentBalance) >= 0.01 && !a.bankItem.itemId.startsWith("mock_bank"))
      .map((a) => ({
        bankItemId: a.bankItemId,
        institution: a.bankItem.institutionName,
        account: a.mask ? `${a.name} ••${a.mask}` : a.name,
        value: a.currentBalance,
        pending: a.bankItem.investmentsStatus === "pending",
      }));

    const portfolio = buildPortfolio(
      holdings.map((h) => ({
        quantity: h.quantity,
        costBasis: h.costBasis,
        institutionPrice: h.institutionPrice,
        institutionValue: h.institutionValue,
        account: { name: h.account.name, mask: h.account.mask, institution: h.account.bankItem.institutionName },
        security: {
          id: h.security.id,
          ticker: h.security.ticker,
          name: h.security.name,
          type: h.security.type,
          isCashEquivalent: h.security.isCashEquivalent,
        },
      })),
      unitemized
    );

    // Only banks whose last sync reported missing investments consent (null = not synced since the feature shipped)
    const needsConsent = new Map<string, string>();
    for (const a of investmentAccounts) {
      const s = a.bankItem.investmentsStatus;
      if (!a.bankItem.itemId.startsWith("mock_bank") && (s === "needs_consent" || (s === null && a._count.holdings === 0 && holdings.length === 0))) {
        needsConsent.set(a.bankItemId, a.bankItem.institutionName);
      }
    }

    return NextResponse.json({
      ...portfolio,
      history: history.map((s) => ({
        date: s.date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
        value: s.totalValue,
      })),
      activity: activity.map((t) => ({
        id: t.id,
        date: t.date.toISOString().split("T")[0],
        name: t.name,
        type: t.type,
        subtype: t.subtype,
        ticker: t.security?.ticker || null,
        quantity: t.quantity,
        price: t.price,
        amount: t.amount,
        institution: t.account.bankItem.institutionName,
      })),
      needsConsent: [...needsConsent.entries()].map(([bankItemId, institution]) => ({ bankItemId, institution })),
    });
  } catch (error) {
    return apiError("Failed to load investments", error);
  }
}
