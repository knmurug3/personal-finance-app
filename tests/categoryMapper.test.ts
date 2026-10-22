import { describe, it, expect } from "vitest";
import { mapPlaidCategoryToStandard, mapPersonalFinanceCategory } from "../lib/categoryMapper";

describe("mapPlaidCategoryToStandard name rules", () => {
  it("still recognises the merchants it's meant to", () => {
    expect(mapPlaidCategoryToStandard("", "RENT PAYMENT")).toBe("Housing");
    expect(mapPlaidCategoryToStandard("", "Shell Oil 1234")).toBe("Transport");
    expect(mapPlaidCategoryToStandard("", "AMC Cinemas")).toBe("Entertainment");
    expect(mapPlaidCategoryToStandard("", "Ross Stores #12")).toBe("Shopping");
    expect(mapPlaidCategoryToStandard("", "AWS EMEA")).toBe("Utilities");
  });
  it("doesn't match words that merely contain a keyword", () => {
    expect(mapPlaidCategoryToStandard("Shops", "ParentSquare")).toBe("Shopping");
    expect(mapPlaidCategoryToStandard("Healthcare", "Walgreens Medicine")).toBe("General");
    expect(mapPlaidCategoryToStandard("Travel", "Las Vegas Hotel")).toBe("Transport");
    expect(mapPlaidCategoryToStandard("Recreation", "Crossfit Loop")).toBe("Entertainment");
    expect(mapPlaidCategoryToStandard("Shops", "Happy Paws Pet")).toBe("Shopping");
    expect(mapPlaidCategoryToStandard("Travel", "Hertz Rent A Car")).toBe("Transport");
  });
});

describe("mapPersonalFinanceCategory", () => {
  it("treats credit card payments as transfers", () => {
    expect(mapPersonalFinanceCategory({ primary: "LOAN_PAYMENTS", detailed: "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT" })).toBe("Transfers");
  });
  it("maps groceries, rent and utilities", () => {
    expect(mapPersonalFinanceCategory({ primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_GROCERIES" })).toBe("Grocery");
    expect(mapPersonalFinanceCategory({ primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_COFFEE" })).toBe("Food & Dining");
    expect(mapPersonalFinanceCategory({ primary: "RENT_AND_UTILITIES", detailed: "RENT_AND_UTILITIES_RENT" })).toBe("Housing");
    expect(mapPersonalFinanceCategory({ primary: "RENT_AND_UTILITIES", detailed: "RENT_AND_UTILITIES_INTERNET_AND_CABLE" })).toBe("Utilities");
  });
  it("returns null when there's no clean mapping", () => {
    expect(mapPersonalFinanceCategory({ primary: "MEDICAL" })).toBeNull();
    expect(mapPersonalFinanceCategory(null)).toBeNull();
  });
});
