import { describe, it, expect } from "vitest";
import { normalizeTransactionDate } from "../lib/plaidMatch";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("normalizeTransactionDate", () => {
  it("moves late-month rent to the 1st of next month", () => {
    expect(normalizeTransactionDate("Rent Payment", "General", d("2026-10-27"))).toEqual(d("2026-11-01"));
    expect(normalizeTransactionDate("Landlord", "Housing", d("2026-12-30"))).toEqual(d("2027-01-01"));
  });
  it("leaves early-month rent alone", () => {
    expect(normalizeTransactionDate("Rent", "Housing", d("2026-10-25"))).toEqual(d("2026-10-25"));
  });
  it("ignores names that merely contain 'rent'", () => {
    for (const name of ["ParentSquare", "Current Card", "Torrent Coffee", "Hertz Rent A Car"]) {
      expect(normalizeTransactionDate(name, "Shopping", d("2026-10-28"))).toEqual(d("2026-10-28"));
    }
  });
});
