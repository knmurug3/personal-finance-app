import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
import { computeBalances, roundMoney } from "../lib/netWorth";

describe("roundMoney", () => {
  it("rounds float drift to whole cents", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(1.005)).toBe(1.01);
  });
});

describe("computeBalances", () => {
  it("counts loans and manual liabilities as debt and manual assets as assets", () => {
    const totals = computeBalances(
      [
        { type: "depository", currentBalance: 1000 },
        { type: "investment", currentBalance: 500 },
        { type: "credit", currentBalance: 200 },
        { type: "loan", currentBalance: 300 },
      ],
      [
        { type: "asset", balance: 50 },
        { type: "liability", balance: 25 },
      ]
    );
    expect(totals).toEqual({
      totalCash: 1000,
      totalInvestments: 500,
      totalCreditDebt: 525,
      creditCardDebt: 200,
      loanDebt: 325,
      totalAssets: 1550,
      netWorth: 1025,
    });
  });
});
