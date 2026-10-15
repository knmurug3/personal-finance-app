import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import { getQuotes, isQuotesConfigured } from "@/lib/quotes";

export const dynamic = "force-dynamic";

/**
 * GET /api/investments/quotes?symbols=AAPL:equity,BTC:cryptocurrency
 * Public market data only, so demo sessions may use it too.
 */
export async function GET(req: Request) {
  const authError = await requireAuth({ allowDemo: true });
  if (authError) return authError;

  if (!isQuotesConfigured()) return NextResponse.json({ configured: false, quotes: {} });

  const raw = new URL(req.url).searchParams.get("symbols") || "";
  const items = raw
    .split(",")
    .map((s) => s.split(":"))
    .filter(([ticker, type]) => ticker && type)
    .map(([ticker, type]) => ({ ticker, type }));

  const quotes = await getQuotes(items);
  return NextResponse.json({ configured: true, quotes, fetchedAt: Date.now() });
}
