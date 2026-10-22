import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isTransfer, isIncomeTransaction, deduplicatePendingTransactions } from "../lib/financeUtils";
import { isPendingMatch } from "../lib/pendingMatch";
import { utcMonthRange } from "../lib/dateUtils";

const tx = (o: Partial<any>) => ({ id: "1", accountId: "a", amount: 10, date: "2026-08-10", name: "Starbucks", merchantName: null, pending: false, ...o });

describe("isPendingMatch", () => {
  it("matches same merchant and amount", () => {
    expect(isPendingMatch(tx({ pending: true }), tx({}))).toBe(true);
  });
  it("does not match different merchants with equal amounts", () => {
    expect(isPendingMatch(tx({ name: "Starbucks" }), tx({ name: "Walmart Supercenter" }))).toBe(false);
  });
  it("matches tip adjustment up to 35%", () => {
    expect(isPendingMatch(tx({ name: "Joes Diner", amount: 28.66 }), tx({ name: "Joes Diner", amount: 30 }))).toBe(true);
    expect(isPendingMatch(tx({ name: "Joes Diner", amount: 10 }), tx({ name: "Joes Diner", amount: 20 }))).toBe(false);
  });
  it("matches $0 pre-auth to posted row of same merchant", () => {
    expect(isPendingMatch(tx({ name: "Shell Oil", amount: 0 }), tx({ name: "Shell Oil", amount: 41.2 }))).toBe(true);
  });
  it("respects account and date window", () => {
    expect(isPendingMatch(tx({}), tx({ accountId: "b" }))).toBe(false);
    expect(isPendingMatch(tx({}), tx({ date: "2026-08-20" }))).toBe(false);
  });
  it("never matches a posted row dated well before the pending one", () => {
    expect(isPendingMatch(tx({ date: "2026-08-12" }), tx({ date: "2026-08-10" }))).toBe(false);
    expect(isPendingMatch(tx({ date: "2026-08-11" }), tx({ date: "2026-08-10" }))).toBe(true);
  });
});

describe("deduplicatePendingTransactions", () => {
  it("drops pending rows that have posted", () => {
    const rows = [tx({ id: "p", pending: true }), tx({ id: "q" }), tx({ id: "r", name: "Other Place", pending: true })];
    expect(deduplicatePendingTransactions(rows).map((r) => r.id)).toEqual(["q", "r"]);
  });
  it("lets one posted row hide only one pending row", () => {
    const rows = [
      tx({ id: "p1", pending: true, date: "2026-08-10" }),
      tx({ id: "p2", pending: true, date: "2026-08-11" }),
      tx({ id: "q", date: "2026-08-11" }),
    ];
    expect(deduplicatePendingTransactions(rows).map((r) => r.id)).toEqual(["p1", "q"]);
  });
});

describe("isTransfer", () => {
  afterEach(() => { delete process.env.TRANSFER_NAME_PATTERNS; });
  it("flags transfer categories and generic names", () => {
    expect(isTransfer("Transfers")).toBe(true);
    expect(isTransfer("Food", "YOU BOUGHT VTI")).toBe(true);
    expect(isTransfer("Food", "Chipotle")).toBe(false);
  });
  it("supports configured patterns", () => {
    expect(isTransfer("General", "ACME TREASURY FUND")).toBe(false);
    process.env.TRANSFER_NAME_PATTERNS = "acme treasury";
    expect(isTransfer("General", "ACME TREASURY FUND")).toBe(true);
  });
});

describe("isIncomeTransaction", () => {
  it("treats Income category and payroll credits as income", () => {
    expect(isIncomeTransaction({ category: "Income", amount: -5, name: "x" })).toBe(true);
    expect(isIncomeTransaction({ category: "General", amount: -5, name: "ACME PAYROLL" })).toBe(true);
    expect(isIncomeTransaction({ category: "General", amount: 5, name: "ACME PAYROLL" })).toBe(false);
  });
});

describe("utcMonthRange", () => {
  it("handles year rollover", () => {
    const r = utcMonthRange(2026, 11);
    expect(r.lt.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});
