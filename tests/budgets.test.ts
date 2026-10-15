import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/push", () => ({ sendPushToAll: vi.fn() }));
import { summarizeSpending, buildBudgetProgress } from "../lib/budgetProgress";
import { alertLevel, alertMessage } from "../lib/budgetAlerts";

const tx = (amount: number, category: string, name = "x", splits?: { category: string; amount: number }[]) => ({
  amount, category, name, date: new Date("2026-10-03T00:00:00Z"), splits,
});

describe("summarizeSpending", () => {
  it("splits, refunds, transfers and income", () => {
    const s = summarizeSpending([
      tx(200, "Shopping", "Costco", [{ category: "Grocery", amount: 150 }, { category: "Shopping", amount: 50 }]),
      tx(48, "Food & Dining"),
      tx(-20, "Food & Dining", "refund"),
      tx(1000, "Transfers"),
      tx(-3600, "Income", "ACME PAYROLL"),
    ]);
    expect(s.categorySpending).toEqual({ Grocery: 150, Shopping: 50, "Food & Dining": 28 });
    expect(s.expenses).toBe(228);
    expect(s.income).toBe(3600);
  });
});

describe("buildBudgetProgress", () => {
  const budget = (category: string, monthlyLimit: number, rollover = false) =>
    ({ id: category, category, emoji: null, monthlyLimit, rollover, rolloverSince: null });

  it("adds rollover to the available amount", () => {
    const [p] = buildBudgetProgress([budget("Food", 400, true)], { Food: 300 }, new Map([["Food", 100]]));
    expect(p).toMatchObject({ effectiveLimit: 500, remaining: 200, percentage: 60, isOver: false, rolloverAmount: 100 });
  });
  it("carried overspending reduces what's available", () => {
    const [p] = buildBudgetProgress([budget("Food", 400, true)], { Food: 350 }, new Map([["Food", -100]]));
    expect(p).toMatchObject({ effectiveLimit: 300, remaining: -50, isOver: true });
  });
  it("ignores carry when rollover is off", () => {
    const [p] = buildBudgetProgress([budget("Food", 400, false)], { Food: 100 }, new Map([["Food", 999]]));
    expect(p.effectiveLimit).toBe(400);
  });
});

describe("budget alerts", () => {
  it("picks the highest crossed level", () => {
    expect(alertLevel(70, 100)).toBe(0);
    expect(alertLevel(85, 100)).toBe(80);
    expect(alertLevel(120, 100)).toBe(100);
  });
  it("words the messages", () => {
    expect(alertMessage("Dining", 340, 400, 80)).toEqual({ title: "Dining at 85%", body: "$60 left this month." });
    expect(alertMessage("Dining", 450, 400, 100).title).toBe("Over budget: Dining");
  });
});
