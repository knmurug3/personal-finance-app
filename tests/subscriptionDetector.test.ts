import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("../lib/db", () => ({ db: {} }));
import { findRecurringCharges } from "../lib/subscriptionDetector";

const now = new Date("2026-10-06T12:00:00Z");
const tx = (name: string, date: string, amount: number, category: string) => ({
  name,
  merchantName: name,
  amount,
  date: new Date(`${date}T00:00:00Z`),
  category,
});
const names = (xs: { merchant: string }[]) => xs.map((x) => x.merchant).sort();

describe("findRecurringCharges", () => {
  it("finds a known subscription and a steady monthly bill", () => {
    const found = findRecurringCharges(
      [
        tx("Netflix", "2026-10-05", 15.49, "Entertainment"),
        tx("Comcast Internet", "2026-08-08", 80, "Utilities"),
        tx("Comcast Internet", "2026-09-08", 80, "Utilities"),
        tx("Comcast Internet", "2026-10-06", 82, "Utilities"),
      ],
      now
    );
    expect(names(found)).toEqual(["Comcast Internet", "Netflix"]);
    expect(found.find((f) => f.merchant === "Netflix")!.nextDueDate.toISOString().slice(0, 10)).toBe("2026-11-05");
  });

  it("ignores grocery runs, irregular amounts or gaps, and stale merchants", () => {
    const found = findRecurringCharges(
      [
        // monthly grocery trips: everyday category
        tx("Whole Foods", "2026-08-03", 120, "Grocery"),
        tx("Whole Foods", "2026-09-03", 120, "Grocery"),
        tx("Whole Foods", "2026-10-03", 120, "Grocery"),
        // amounts vary too much
        tx("Local Garage", "2026-08-01", 40, "Utilities"),
        tx("Local Garage", "2026-09-01", 300, "Utilities"),
        tx("Local Garage", "2026-10-01", 45, "Utilities"),
        // only two charges
        tx("Some Service", "2026-09-01", 9, "Entertainment"),
        tx("Some Service", "2026-10-01", 9, "Entertainment"),
        // stopped charging months ago
        tx("Old Gym Fitness", "2026-05-01", 30, "Health & Fitness"),
        // card payments are never bills
        tx("Payment Thank You", "2026-10-01", 500, "General"),
      ],
      now
    );
    expect(found).toEqual([]);
  });
});
