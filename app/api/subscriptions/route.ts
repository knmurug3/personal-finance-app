import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/apiError";
import { cleanString, SUBSCRIPTION_FREQUENCIES, SUBSCRIPTION_STATUSES } from "@/lib/validate";
import type { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/requireAuth";
import { detectSubscriptionsIfDue } from "@/lib/subscriptionDetector";
import { deduplicatePendingTransactions } from "@/lib/financeUtils";
import { monthlyEquivalent } from "@/lib/money";

export const dynamic = "force-dynamic";

// Cache detection removed in-memory throttle

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    // Tracked separately so editing a subscription doesn't postpone detection
    await detectSubscriptionsIfDue();

    const subscriptions = await db.subscription.findMany({
      where: {
        status: { not: "dismissed" },
      },
      orderBy: { nextDueDate: "asc" },
    });

    const activeSubs = subscriptions.filter((s) => s.status === "active");
    
    const merchantNames = Array.from(
      new Set(subscriptions.map((s) => s.merchantName).filter(Boolean))
    ) as string[];

    const allTxs = await db.transaction.findMany({
      where: {
        merchantName: { in: merchantNames },
      },
      orderBy: { date: "desc" },
    });

    const cleanTxs = deduplicatePendingTransactions(allTxs);

    const txsByMerchant: Record<string, any[]> = {};
    for (const tx of cleanTxs) {
      if (!tx.merchantName) continue;
      if (!txsByMerchant[tx.merchantName]) {
        txsByMerchant[tx.merchantName] = [];
      }
      txsByMerchant[tx.merchantName].push(tx);
    }

    const enhancedSubscriptions = subscriptions.map((sub) => {
      if (!sub.merchantName) return sub;

      const subTxs = txsByMerchant[sub.merchantName] || [];
      if (subTxs.length >= 2) {
        const diff = Math.abs(subTxs[0].amount - subTxs[1].amount);
        if (diff > 0.5) {
          return {
            ...sub,
            priceChanged: true,
            oldPrice: subTxs[1].amount,
            newPrice: subTxs[0].amount,
          };
        }
      }
      return sub;
    });

    const activeEnhancedSubs = enhancedSubscriptions.filter((s) => s.status === "active");
    // Yearly / quarterly / weekly bills are converted to their monthly cost
    const totalMonthlyCost = activeEnhancedSubs.reduce(
      (acc, sub) => acc + monthlyEquivalent(sub.amount, sub.frequency),
      0
    );

    return NextResponse.json({
      subscriptions: enhancedSubscriptions,
      totalMonthlyCost: Math.round(totalMonthlyCost * 100) / 100,
    });
  } catch (error) {
    return apiError("Failed to fetch subscriptions", error);
  }
}

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const body = await req.json();
    const { name, merchantName, amount, frequency, nextDueDate, category } = body;

    if (!name || !amount || !nextDueDate) {
      return NextResponse.json(
        { error: "Name, amount, and nextDueDate are required." },
        { status: 400 }
      );
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100_000) {
      return NextResponse.json({ error: "Invalid amount value." }, { status: 400 });
    }

    const parsedDate = new Date(nextDueDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Invalid nextDueDate format." }, { status: 400 });
    }

    if (frequency !== undefined && !(SUBSCRIPTION_FREQUENCIES as readonly string[]).includes(frequency)) {
      return NextResponse.json({ error: "Invalid frequency." }, { status: 400 });
    }
    if (category !== undefined && !cleanString(category, 100)) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }

    const subscription = await db.subscription.create({
      data: {
        name: String(name).substring(0, 200),
        merchantName: merchantName || null,
        amount: parsedAmount,
        frequency: frequency || "monthly",
        nextDueDate: parsedDate,
        category: category || "Entertainment",
        status: "active",
      },
    });

    return NextResponse.json(subscription);
  } catch (error) {
    return apiError("Failed to create subscription", error);
  }
}

export async function PUT(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const body = await req.json();
    const { id, status, name, amount, category, frequency, nextDueDate } = body;

    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "Subscription ID is required." }, { status: 400 });
    }

    if (status !== undefined && !(SUBSCRIPTION_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    if (frequency !== undefined && !(SUBSCRIPTION_FREQUENCIES as readonly string[]).includes(frequency)) {
      return NextResponse.json({ error: "Invalid frequency." }, { status: 400 });
    }
    if (category !== undefined && !cleanString(category, 100)) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }
    if (amount !== undefined) {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0 || n > 100_000) {
        return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
      }
    }
    if (nextDueDate !== undefined && isNaN(new Date(nextDueDate).getTime())) {
      return NextResponse.json({ error: "Invalid nextDueDate." }, { status: 400 });
    }

    const updateData: Prisma.SubscriptionUpdateInput = {};
    if (status !== undefined) updateData.status = status;
    if (name !== undefined) updateData.name = String(name).substring(0, 200);
    if (amount !== undefined) {
      const parsed = parseFloat(amount);
      if (!isNaN(parsed)) updateData.amount = parsed;
    }
    if (category !== undefined) updateData.category = category;
    if (frequency !== undefined) updateData.frequency = frequency;
    if (nextDueDate !== undefined) {
      const parsed = new Date(nextDueDate);
      if (!isNaN(parsed.getTime())) updateData.nextDueDate = parsed;
    }

    const subscription = await db.subscription.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(subscription);
  } catch (error) {
    return apiError("Failed to update subscription", error);
  }
}

export async function DELETE(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Subscription ID is required." }, { status: 400 });
    }

    const updated = await db.subscription.update({
      where: { id },
      data: { status: "dismissed" },
    });

    return NextResponse.json({ success: true, message: "Subscription deleted permanently.", subscription: updated });
  } catch (error) {
    return apiError("Failed to delete subscription", error);
  }
}
