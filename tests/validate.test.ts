import { describe, it, expect } from "vitest";
import { cleanString, finiteNumber } from "../lib/validate";

describe("validators", () => {
  it("cleanString trims and bounds", () => {
    expect(cleanString("  hi ", 5)).toBe("hi");
    expect(cleanString("", 5)).toBeNull();
    expect(cleanString("toolong", 3)).toBeNull();
    expect(cleanString(5, 3)).toBeNull();
  });
  it("finiteNumber rejects NaN/Infinity/blank", () => {
    expect(finiteNumber("12.5")).toBe(12.5);
    expect(finiteNumber("abc")).toBeNull();
    expect(finiteNumber("")).toBeNull();
    expect(finiteNumber(Infinity)).toBeNull();
  });
});
