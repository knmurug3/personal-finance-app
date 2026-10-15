import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapPlaidCategoryToStandard } from "@/lib/categoryMapper";
import { utcMonthRange, utcYearRange } from "@/lib/dateUtils";
import { apiError } from "@/lib/apiError";
import { requireAuth } from "@/lib/requireAuth";
import { appToday } from "@/lib/appTime";
import { computeBalances, roundMoney } from "@/lib/netWorth";
import { loadTransactions, summarizeSpending, rolloverCarry, buildBudgetProgress } from "@/lib/budgetProgress";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get("month");

    const accounts = await db.account.findMany({
      include: { bankItem: true },
    });

    // Only load the requested period (padded so pending/posted pairs at the edges still dedupe)
    const today = appToday();
    let range: { gte: Date; lt: Date };
    if (monthParam === "ytd") {
      range = utcYearRange(today.year);
    } else if (monthParam && monthParam !== "current" && /^\d{4}-\d{1,2}$/.test(monthParam)) {
      const [y, m] = monthParam.split("-").map(Number);
      range = utcMonthRange(y, m - 1);
    } else {
      range = utcMonthRange(today.year, today.month0);
    }

    const transactions = (await loadTransactions(range)).map((tx) => ({
      ...tx,
      category: tx.category || mapPlaidCategoryToStandard("", tx.name),
    }));

    const budgets = await db.budget.findMany();
    const manualAccounts = await db.manualAccount.findMany();

    const { totalCash, totalInvestments, totalCreditDebt, creditCardDebt, loanDebt, totalAssets, netWorth } = computeBalances(accounts, manualAccounts);

    const { categorySpending, income: currentMonthIncome, expenses: currentMonthExpenses } = summarizeSpending(transactions);

    // Rollover only applies to a single month (YTD sums plain monthly limits)
    const carry = monthParam === "ytd" ? new Map<string, number>() : await rolloverCarry(budgets, range.gte);
    const budgetProgress = buildBudgetProgress(budgets, categorySpending, carry);

    return NextResponse.json({
      netWorth: roundMoney(netWorth),
      totalAssets: roundMoney(totalAssets),
      totalCash: roundMoney(totalCash),
      totalInvestments: roundMoney(totalInvestments),
      totalCreditDebt: roundMoney(totalCreditDebt),
      creditCardDebt,
      loanDebt,
      currentMonthIncome: roundMoney(currentMonthIncome),
      currentMonthExpenses: roundMoney(currentMonthExpenses),
      accounts: accounts.map((a) => ({
        id: a.id,
        bankItemId: a.bankItemId,
        name: a.name,
        officialName: a.officialName,
        mask: a.mask,
        type: a.type,
        subtype: a.subtype,
        currentBalance: a.currentBalance,
        institutionName: a.bankItem?.institutionName || "Bank",
        status: a.bankItem?.status || "active",
        updatedAt: a.bankItem?.updatedAt || a.updatedAt,
      })),
      manualAccounts,
      categorySpending,
      budgetProgress,
    });
  } catch (error) {
    return apiError("Failed to load dashboard data", error);
  }
}
