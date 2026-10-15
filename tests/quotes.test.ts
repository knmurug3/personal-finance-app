import { describe, it, expect, vi, beforeEach } from "vitest";
import { finnhubSymbol, getQuotes } from "../lib/quotes";

describe("finnhubSymbol", () => {
  it("maps stocks, ETFs and crypto; skips what Finnhub can't price", () => {
    expect(finnhubSymbol("aapl", "equity")).toBe("AAPL");
    expect(finnhubSymbol("VOO", "etf")).toBe("VOO");
    expect(finnhubSymbol("BTC", "cryptocurrency")).toBe("BINANCE:BTCUSDT");
    expect(finnhubSymbol("USDC", "cryptocurrency")).toBeNull();
    expect(finnhubSymbol("FXAIX", "mutual fund")).toBeNull();
    expect(finnhubSymbol("CUR:USD", "cash")).toBeNull();
    expect(finnhubSymbol("BAD SYMBOL!", "equity")).toBeNull();
  });
});

describe("getQuotes", () => {
  beforeEach(() => {
    process.env.FINNHUB_API_KEY = "test";
    vi.restoreAllMocks();
  });

  it("returns quotes keyed by ticker, drops unknown (all-zero) symbols, and caches", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
      const sym = new URL(String(url)).searchParams.get("symbol");
      const body = sym === "NVDA" ? { c: 120, d: 2.4, dp: 2.04, pc: 117.6, t: 1 } : { c: 0, d: null, dp: null, pc: 0, t: 0 };
      return new Response(JSON.stringify(body), { status: 200 });
    });

    const q = await getQuotes([{ ticker: "NVDA", type: "equity" }, { ticker: "ZZZZ", type: "equity" }]);
    expect(Object.keys(q)).toEqual(["NVDA"]);
    expect(q.NVDA.price).toBe(120);
    expect(q.NVDA.changePct).toBeCloseTo(0.0204);

    await getQuotes([{ ticker: "NVDA", type: "equity" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2); // second call served from cache
  });
});
