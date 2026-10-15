/**
 * Live quotes from Finnhub (https://finnhub.io, free tier: 60 calls/min).
 * Server-only — the API key never reaches the browser. Results are cached
 * per symbol for 60s so polling clients don't multiply upstream calls.
 */

export interface Quote {
  price: number;
  change: number;
  changePct: number;
  prevClose: number;
  time: number;
}

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; quote: Quote | null }>();

export const isQuotesConfigured = () => Boolean(process.env.FINNHUB_API_KEY);

const STABLECOINS = new Set(["USDC", "USDT", "DAI", "PYUSD"]);

/** Maps a holding to a Finnhub symbol; null when Finnhub can't price it (cash, mutual funds, options). */
export function finnhubSymbol(ticker: string, type: string): string | null {
  const t = ticker.toUpperCase();
  if (!/^[A-Z0-9.\-]{1,12}$/.test(t)) return null;
  if (type === "cryptocurrency") return STABLECOINS.has(t) ? null : `BINANCE:${t}USDT`;
  if (type === "equity" || type === "etf") return t;
  return null;
}

async function fetchQuote(symbol: string): Promise<Quote | null> {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${process.env.FINNHUB_API_KEY}`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const q = await res.json();
  // Unknown symbols come back as all zeros
  if (!q || typeof q.c !== "number" || q.c === 0) return null;
  return { price: q.c, change: q.d ?? 0, changePct: (q.dp ?? 0) / 100, prevClose: q.pc ?? 0, time: (q.t ?? 0) * 1000 };
}

/** Quotes keyed by the caller's ticker. Missing entries mean "no live price" — fall back to Plaid's. */
export async function getQuotes(items: { ticker: string; type: string }[]): Promise<Record<string, Quote>> {
  const out: Record<string, Quote> = {};
  const now = Date.now();
  const todo: { ticker: string; symbol: string }[] = [];

  for (const { ticker, type } of items.slice(0, 50)) {
    const symbol = finnhubSymbol(ticker, type);
    if (!symbol) continue;
    const hit = cache.get(symbol);
    if (hit && now - hit.at < CACHE_MS) {
      if (hit.quote) out[ticker.toUpperCase()] = hit.quote;
    } else {
      todo.push({ ticker: ticker.toUpperCase(), symbol });
    }
  }

  // Small concurrency keeps us well inside the free tier's rate limit
  for (let i = 0; i < todo.length; i += 8) {
    await Promise.all(
      todo.slice(i, i + 8).map(async ({ ticker, symbol }) => {
        const quote = await fetchQuote(symbol).catch(() => null);
        cache.set(symbol, { at: Date.now(), quote });
        if (quote) out[ticker] = quote;
      })
    );
  }
  return out;
}
