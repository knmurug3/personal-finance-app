import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { after } from "next/server";
import { reportError, errorText } from "@/lib/errorReport";

const isProd = process.env.NODE_ENV === "production";

/**
 * Standard error response: a record that doesn't exist (Prisma P2025) is a 404;
 * anything else is logged and returned as 500 (details only outside production).
 */
export function apiError(message: string, err?: unknown, status = 500) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (err) console.error(message, err);
  if (status >= 500) {
    // Record and alert after the response is sent; outside a request scope just skip
    try {
      after(() => reportError({ source: "Server", message: `${message}: ${errorText(err)}` }));
    } catch {}
  }
  const detail = err instanceof Error ? err.message : undefined;
  return NextResponse.json({ error: isProd ? message : detail || message }, { status });
}
