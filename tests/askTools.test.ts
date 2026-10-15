import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
import { runAskTool, ASK_TOOLS } from "../lib/ask/tools";
import type { AskSnapshot } from "../lib/ask/data";

const tx = (date: string, amount: number, name: string, category: string) => ({
  date: new Date(`${date}T12:00:00Z`),
  amount,
  name,
  merchant: name,
  category,
  account: "Checking",
  pending: false,
});

const snap: AskSnapshot = {
  transactions: [
    tx("2026-09-03", 50, "Whole Foods", "Food & Dining"),
    tx("2026-09-10", 30, "Chipotle", "Food & Dining"),
    tx("2026-09-12", -10, "Chipotle Refund", "Food & Dining"),
    tx("2026-09-15", 1000, "Transfer to Savings", "Transfers"),
    tx("2026-09-01", -3000, "ACME PAYROLL", "Income"),
    tx("2026-10-02", 20, "Uber", "Transport"),
  ],
  accounts: [
    { name: "Checking", institution: "Chase", type: "depository", subtype: "checking", mask: "1111", balance: 2000 },
    { name: "Card", institution: "Amex", type: "credit", subtype: "credit card", mask: "2222", balance: 500 },
  ],
  manualAccounts: [],
  budgets: [{ category: "Food & Dining", monthlyLimit: 100 }],
  subscriptions: [{ name: "Netflix", amount: 120, frequency: "yearly", nextDueDate: "2026-11-01", category: "Entertainment" }],
  portfolio: null,
  netWorthHistory: [
    { date: "2026-09-01", netWorth: 1000 },
    { date: "2026-10-01", netWorth: 1500 },
  ],
};

const run = (name: string, input: unknown = {}) => {
  const r = runAskTool(snap, name, input);
  return { ...r, json: r.isError ? null : JSON.parse(r.content) };
};

describe("ask tools", () => {
  it("every tool streams inputs eagerly and has an object schema", () => {
    for (const t of ASK_TOOLS) {
      expect(t.eager_input_streaming).toBe(true);
      expect(t.input_schema.type).toBe("object");
    }
  });

  it("spending_summary excludes transfers and income, nets refunds", () => {
    const { json } = run("spending_summary", { start_date: "2026-09-01", end_date: "2026-09-30", group_by: "category" });
    expect(json.total_spending).toBe(70);
    expect(json.total_income).toBe(3000);
    expect(json.groups).toEqual([{ category: "Food & Dining", total: 70, transactions: 3 }]);
  });

  it("search_transactions filters by text and reports matches", () => {
    const { json } = run("search_transactions", { query: "chipotle" });
    expect(json.match_count).toBe(2);
    expect(json.transactions[0].name).toBe("Chipotle Refund");
  });

  it("get_budgets computes spent for the requested month", () => {
    const { json } = run("get_budgets", { month: "2026-09" });
    expect(json.budgets[0]).toMatchObject({ category: "Food & Dining", spent: 70, remaining: 30, percent_used: 70 });
  });

  it("get_accounts treats credit as owed", () => {
    const { json } = run("get_accounts");
    expect(json.netWorth).toBe(1500);
    expect(json.accounts.find((a: any) => a.institution === "Amex").owed).toBe(true);
  });

  it("get_recurring converts yearly to monthly", () => {
    expect(run("get_recurring").json.total_per_month).toBe(10);
  });

  it("rejects malformed input as a tool error instead of throwing", () => {
    expect(run("spending_summary", { start_date: "Sept 1", end_date: "2026-09-30", group_by: "category" }).isError).toBe(true);
    expect(run("spending_summary", { start_date: "2026-09-01", end_date: "2026-09-30", group_by: "year" }).isError).toBe(true);
    expect(run("nope").isError).toBe(true);
  });

  it("get_investments reports when nothing is connected", () => {
    expect(run("get_investments").json.connected).toBe(false);
  });
});
