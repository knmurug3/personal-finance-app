import { describe, it, expect } from "vitest";
import { buildPortfolio, type HoldingInput } from "../lib/portfolio";

const brokerageA = { name: "Brokerage", mask: "1111", institution: "Brokerage A" };
const brokerageB = { name: "Individual", mask: "2222", institution: "Brokerage B" };
const sec = (ticker: string, type = "equity", isCashEquivalent = false) => ({ id: ticker, ticker, name: `${ticker} Inc`, type, isCashEquivalent });

const h = (account: HoldingInput["account"], security: HoldingInput["security"], quantity: number, price: number, costBasis: number | null): HoldingInput => ({
  quantity,
  costBasis,
  institutionPrice: price,
  institutionValue: quantity * price,
  account,
  security,
});

describe("buildPortfolio", () => {
  const p = buildPortfolio([
    h(brokerageA, sec("AAPL"), 10, 200, 1500),
    h(brokerageB, sec("AAPL"), 5, 200, 1000),
    h(brokerageB, sec("VTI", "etf"), 2, 250, 400),
    h(brokerageA, sec("MMKT", "mutual fund", true), 100, 1, 100),
    h(brokerageB, sec("NVDA"), 1, 100, null),
  ]);

  it("merges the same ticker across brokerages", () => {
    const aapl = p.positions.find((x) => x.ticker === "AAPL")!;
    expect(aapl.quantity).toBe(15);
    expect(aapl.value).toBe(3000);
    expect(aapl.costBasis).toBe(2500);
    expect(aapl.gain).toBe(500);
    expect(aapl.gainPct).toBeCloseTo(0.2);
    expect(aapl.accounts.map((a) => a.institution)).toEqual(["Brokerage A", "Brokerage B"]);
  });

  it("collapses cash equivalents and sorts by value", () => {
    expect(p.positions.map((x) => x.key)).toEqual(["AAPL", "VTI", "CASH", "NVDA"]);
    expect(p.positions.find((x) => x.key === "CASH")!.gain).toBeNull();
  });

  it("leaves gain unknown when cost basis is missing and excludes it from totals", () => {
    const nvda = p.positions.find((x) => x.ticker === "NVDA")!;
    expect(nvda.gain).toBeNull();
    expect(p.totalValue).toBe(3700);
    expect(p.totalCost).toBe(2900);
    expect(p.totalGain).toBe(600);
  });

  it("computes allocation, institutions and concentration", () => {
    expect(p.allocation.map((a) => a.label)).toEqual(["Stocks", "ETFs", "Cash"]);
    expect(p.institutions).toEqual([
      { institution: "Brokerage B", value: 1600 },
      { institution: "Brokerage A", value: 2100 },
    ].sort((a, b) => b.value - a.value));
    expect(p.concentrated.map((c) => c.ticker)).toEqual(["AAPL"]);
  });

  it("keeps crypto flagged as cash-equivalent as crypto, with gains", () => {
    const c = buildPortfolio([h(brokerageB, { id: "BTC", ticker: "BTC", name: "Bitcoin", type: "cryptocurrency", isCashEquivalent: true }, 0.01, 60000, 500)]);
    expect(c.positions[0].key).toBe("BTC");
    expect(c.positions[0].type).toBe("cryptocurrency");
    expect(c.positions[0].gain).toBe(100);
  });

  it("counts unitemized account balances in totals but not in returns", () => {
    const u = buildPortfolio([h(brokerageA, sec("VOO", "etf"), 1, 500, 400)], [
      { institution: "Brokerage A", account: "Individual ••2323", value: 1000 },
    ]);
    expect(u.totalValue).toBe(1500);
    expect(u.totalGain).toBe(100);
    expect(u.institutions).toEqual([{ institution: "Brokerage A", value: 1500 }]);
    expect(u.allocation.find((a) => a.type === "unitemized")?.label).toBe("Not itemized");
    expect(u.positions.find((p) => p.key === "VOO")!.weight).toBeCloseTo(1 / 3);
  });
});
