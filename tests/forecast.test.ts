import { describe, it, expect } from "vitest";
import { buildForecast, detectPaychecks, billOccurrences } from "../lib/forecast";

const T = (date: string, amount: number, name: string, category: string) => ({ date: `${date}T00:00:00Z`, amount, name, merchantName: name, category });
const today = new Date("2026-10-06T00:00:00Z");

describe("detectPaychecks", () => {
  it("detects semimonthly (1st & 15th) and projects the next dates", () => {
    const tx = ["2026-07-01", "2026-07-15", "2026-08-01", "2026-08-15", "2026-09-01", "2026-09-15", "2026-10-01"].map((d) => T(d, -3600, "ACME PAYROLL", "Income"));
    const [s] = detectPaychecks(tx, today);
    expect(s.cadence).toBe("semimonthly");
    expect(s.next(today, new Date("2026-11-20T00:00:00Z")).map((d) => d.toISOString().slice(0, 10))).toEqual(["2026-10-15", "2026-11-01", "2026-11-15"]);
  });
  it("detects biweekly", () => {
    const tx = ["2026-08-07", "2026-08-21", "2026-09-04", "2026-09-18", "2026-10-02"].map((d) => T(d, -2000, "Employer", "Income"));
    const [s] = detectPaychecks(tx, today);
    expect(s.cadence).toBe("biweekly");
    expect(s.next(today, new Date("2026-10-31T00:00:00Z")).map((d) => d.toISOString().slice(0, 10))).toEqual(["2026-10-16", "2026-10-30"]);
  });
  it("ignores one-off deposits", () => {
    expect(detectPaychecks([T("2026-09-10", -500, "Tax refund", "Income")], today)).toEqual([]);
  });
});

describe("billOccurrences", () => {
  it("steps monthly and yearly, clamping month ends", () => {
    const until = new Date("2027-02-28T00:00:00Z");
    expect(billOccurrences({ name: "Rent", amount: 2100, frequency: "monthly", nextDueDate: "2026-10-31" }, today, until).map((d) => d.toISOString().slice(0, 10)))
      .toEqual(["2026-10-31", "2026-11-30", "2026-12-31", "2027-01-31", "2027-02-28"]);
    expect(billOccurrences({ name: "Prime", amount: 139, frequency: "yearly", nextDueDate: "2026-12-10" }, today, until)).toHaveLength(1);
  });
});

describe("buildForecast", () => {
  it("applies paychecks, bills and daily spending; finds the low point", () => {
    const tx = [
      ...["2026-08-01", "2026-08-15", "2026-09-01", "2026-09-15", "2026-10-01"].map((d) => T(d, -3000, "ACME PAYROLL", "Income")),
      // everyday spending: $600 over the last 60 days = $10/day
      ...Array.from({ length: 30 }, (_, i) => T(`2026-09-${String(i + 1).padStart(2, "0")}`, 20, "Cafe", "Food & Dining")),
      // a bill's own charges don't count as everyday spending
      T("2026-09-05", 2100, "Rent Co", "Housing"),
      T("2026-09-20", 1000, "Transfer to Savings", "Transfers"),
    ];
    const f = buildForecast({
      startBalance: 1000,
      today: "2026-10-06",
      transactions: tx,
      bills: [{ name: "Rent Co", amount: 2100, frequency: "monthly", nextDueDate: "2026-10-10" }],
      days: 30,
      threshold: 500,
    });
    expect(f.dailySpend).toBe(10);
    expect(f.events.map((e) => `${e.date} ${e.kind} ${e.amount}`)).toEqual([
      "2026-10-10 bill -2100",
      "2026-10-15 paycheck 3000",
      "2026-11-01 paycheck 3000",
    ]);
    // Rent on Oct 10 (1000 − 4×10 − 2100 = −1140), then $10/day until payday on the 15th:
    // the low point is Oct 14 at −1180; flagged under the threshold
    expect(f.lowest).toEqual({ date: "2026-10-14", balance: -1180 });
    expect(f.belowThreshold).toBe(true);
    expect(f.endBalance).toBe(1000 - 30 * 10 - 2100 + 3000 + 3000);
  });
});
