import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/apiError";
import { cleanString, finiteNumber } from "@/lib/validate";
import { requireAuth } from "@/lib/requireAuth";
import { appToday } from "@/lib/appTime";

export const dynamic = "force-dynamic";

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const budgets = await db.budget.findMany({
      orderBy: { category: "asc" },
    });
    return NextResponse.json(budgets);
  } catch (error) {
    return apiError("Failed to fetch budgets", error);
  }
}

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const body = await req.json();
    const { category, emoji, monthlyLimit, rollover } = body;
    if (rollover !== undefined && typeof rollover !== "boolean") {
      return NextResponse.json({ error: "Invalid rollover flag." }, { status: 400 });
    }

    if (!category || monthlyLimit === undefined) {
      return NextResponse.json(
        { error: "Category and monthlyLimit are required." },
        { status: 400 }
      );
    }

    const parsedLimit = finiteNumber(monthlyLimit);
    if (parsedLimit === null || parsedLimit < 0 || parsedLimit > 1_000_000) {
      return NextResponse.json({ error: "Invalid monthlyLimit value." }, { status: 400 });
    }

    const cleanCategory = cleanString(category, 100);
    if (!cleanCategory) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }
    const cleanEmoji = cleanString(emoji, 16) || "📦";

    // Turning rollover on starts the running balance with the current month
    const today = appToday();
    const thisMonth = new Date(Date.UTC(today.year, today.month0, 1));
    const existing = await db.budget.findUnique({ where: { category: cleanCategory } });
    const rolloverData =
      rollover === undefined
        ? {}
        : rollover
          ? { rollover: true, rolloverSince: existing?.rollover && existing.rolloverSince ? existing.rolloverSince : thisMonth }
          : { rollover: false, rolloverSince: null };

    const budget = await db.budget.upsert({
      where: { category: cleanCategory },
      update: {
        monthlyLimit: parsedLimit,
        emoji: cleanEmoji,
        ...rolloverData,
      },
      create: {
        category: cleanCategory,
        emoji: cleanEmoji,
        monthlyLimit: parsedLimit,
        ...rolloverData,
      },
    });

    return NextResponse.json(budget);
  } catch (error) {
    return apiError("Failed to save budget category", error);
  }
}

export async function DELETE(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    if (!category) {
      return NextResponse.json({ error: "Category name required" }, { status: 400 });
    }

    await db.budget.delete({
      where: { category },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError("Failed to delete budget", error);
  }
}
