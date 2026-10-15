import { db } from "@/lib/db";
import { roundMoney } from "@/lib/money";
import { appTodayDate } from "@/lib/appTime";

export { roundMoney };

export interface BalanceTotals {
  totalCash: number;
  totalInvestments: number;
  /** Credit cards + loans + manual liabilities */
  totalCreditDebt: number;
  /** Breakdown of totalCreditDebt */
  creditCardDebt: number;
  loanDebt: number;
  totalAssets: number;
  netWorth: number;
}

/**
 * Single source of truth for net worth, shared by the dashboard, the history
 * chart and daily snapshots so they always agree.
 */
export function computeBalances(
  accounts: { type: string; currentBalance: number }[],
  manualAccounts: { type: string; balance: number }[]
): BalanceTotals {
  let totalCash = 0;
  let totalInvestments = 0;
  let totalCreditDebt = 0;
  let creditCardDebt = 0;
  let loanDebt = 0;
  let manualAssets = 0;

  for (const acc of accounts) {
    if (acc.type === "depository") totalCash += acc.currentBalance;
    else if (acc.type === "investment") totalInvestments += acc.currentBalance;
    else if (acc.type === "credit") creditCardDebt += acc.currentBalance;
    else if (acc.type === "loan") loanDebt += acc.currentBalance;
  }
  for (const acc of manualAccounts) {
    if (acc.type === "asset") manualAssets += acc.balance;
    else if (acc.type === "liability") loanDebt += acc.balance;
  }
  totalCreditDebt = creditCardDebt + loanDebt;

  const totalAssets = totalCash + totalInvestments + manualAssets;
  return {
    totalCash: roundMoney(totalCash),
    totalInvestments: roundMoney(totalInvestments),
    totalCreditDebt: roundMoney(totalCreditDebt),
    creditCardDebt: roundMoney(creditCardDebt),
    loanDebt: roundMoney(loanDebt),
    totalAssets: roundMoney(totalAssets),
    netWorth: roundMoney(totalAssets - totalCreditDebt),
  };
}

/** Upserts today's (UTC) snapshot from live balances and returns the totals. */
export async function recordNetWorthSnapshot(): Promise<BalanceTotals> {
  const [accounts, manualAccounts] = await Promise.all([db.account.findMany(), db.manualAccount.findMany()]);
  const totals = computeBalances(accounts, manualAccounts);
  const date = appTodayDate();
  const data = {
    netWorth: totals.netWorth,
    totalAssets: totals.totalAssets,
    totalCash: totals.totalCash,
    totalInvestments: totals.totalInvestments,
    totalDebt: totals.totalCreditDebt,
  };
  await db.netWorthSnapshot.upsert({ where: { date }, update: data, create: { date, ...data } });
  return totals;
}
