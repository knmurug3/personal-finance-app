import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/requireAuth";
import { appToday } from "@/lib/appTime";
import { padRange } from "@/lib/dateUtils";
import { apiError } from "@/lib/apiError";
import { isTransfer, isIncomeTransaction, getIncomeAmount, deduplicatePendingTransactions, categoryParts } from "@/lib/financeUtils";

export const dynamic = "force-dynamic";

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const today = appToday();
    const currentYear = today.year;
    const currentMonth = today.month0;
    const currentDay = today.day;
    const daysInMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();

    // Only the six-month window is needed
    const windowRange = {
      gte: new Date(Date.UTC(currentYear, currentMonth - 5, 1)),
      lt: new Date(Date.UTC(currentYear, currentMonth + 1, 1)),
    };
    const rawTransactions = await db.transaction.findMany({
      where: { date: padRange(windowRange) },
      orderBy: { date: "asc" },
      include: { splits: { select: { category: true, amount: true } } },
    });

    const transactions = deduplicatePendingTransactions(rawTransactions);

    const monthlySummary: {
      key: string;
      label: string;
      year: number;
      month: number;
      income: number;
      spending: number;
      netSavings: number;
      savingsRate: number;
      categories: Record<string, number>;
    }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(currentYear, currentMonth - i, 1));
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
      const key = `${y}-${String(m + 1).padStart(2, "0")}`;
      monthlySummary.push({ key, label, year: y, month: m, income: 0, spending: 0, netSavings: 0, savingsRate: 0, categories: {} });
    }

    transactions.forEach((tx) => {
      // MED-02/03 fix: use shared utils — identical logic as dashboard route
      if (isTransfer(tx.category, tx.name)) return;

      const txDate = new Date(tx.date);
      const bucket = monthlySummary.find((b) => b.year === txDate.getUTCFullYear() && b.month === txDate.getUTCMonth());
      if (!bucket) return;

      if (isIncomeTransaction(tx)) {
        bucket.income += getIncomeAmount(tx);
      } else {
        // Positive = expense, negative = refund
        bucket.spending += tx.amount;
        for (const part of categoryParts(tx)) {
          bucket.categories[part.category] = (bucket.categories[part.category] || 0) + part.amount;
        }
      }
    });

    monthlySummary.forEach((b) => {
      b.income = Math.max(0, Math.round(b.income * 100) / 100);
      b.spending = Math.max(0, Math.round(b.spending * 100) / 100);
      // Clamp negative category values
      Object.keys(b.categories).forEach((cat) => {
        b.categories[cat] = Math.max(0, b.categories[cat]);
      });
      b.netSavings = Math.round((b.income - b.spending) * 100) / 100;
      b.savingsRate = b.income > 0 ? Math.max(0, Math.round(((b.income - b.spending) / b.income) * 100)) : 0;
    });

    const currentMonthBucket = monthlySummary[monthlySummary.length - 1];
    const prevMonthBucket = monthlySummary[monthlySummary.length - 2];

    const currentIncome = currentMonthBucket?.income || 0;
    const prevIncome = prevMonthBucket?.income || 0;
    const incomeMoM = prevIncome > 0 ? Math.round(((currentIncome - prevIncome) / prevIncome) * 100) : 0;

    const currentSpending = currentMonthBucket?.spending || 0;
    const prevSpending = prevMonthBucket?.spending || 0;
    const spendingMoM = prevSpending > 0 ? Math.round(((currentSpending - prevSpending) / prevSpending) * 100) : 0;

    const currentSavings = currentMonthBucket?.netSavings || 0;
    const prevSavings = prevMonthBucket?.netSavings || 0;
    const savingsMoM = prevSavings !== 0 ? Math.round(((currentSavings - prevSavings) / Math.abs(prevSavings)) * 100) : 0;

    const allCategoryNames = Array.from(
      new Set([...Object.keys(currentMonthBucket?.categories || {}), ...Object.keys(prevMonthBucket?.categories || {})])
    );

    const categoryMoM = allCategoryNames.map((cat) => {
      const current = Math.max(0, currentMonthBucket?.categories[cat] || 0);
      const prev = Math.max(0, prevMonthBucket?.categories[cat] || 0);
      const diff = Math.round((current - prev) * 100) / 100;
      const pct = prev > 0 ? Math.round((diff / prev) * 100) : current > 0 ? 100 : 0;
      return { category: cat, currentSpent: Math.round(current * 100) / 100, prevSpent: Math.round(prev * 100) / 100, diff, pct };
    });

    return NextResponse.json({
      currentDay, daysInMonth, monthlySummary,
      currentIncome, prevIncome, incomeMoM,
      currentSpending, prevSpending, spendingMoM,
      currentSavings, prevSavings, savingsMoM,
      categoryMoM,
    });
  } catch (error) {
    return apiError("Failed to fetch analytics", error);
  }
}
