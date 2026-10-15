import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import * as crypto from "crypto";
import { db } from "@/lib/db";

/**
 * Returns the SESSION_SECRET at runtime — throws if not set.
 * Checking inside a function (not at module level) prevents Next.js
 * static build from failing during page-data collection.
 */
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET must be set (min 16 chars)");
  }
  // Mixing in the owner password means changing it invalidates every existing session
  return `${secret}:${process.env.AUTH_PASSWORD || ""}`;
}

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Signs a session value with HMAC-SHA256 so it cannot be forged.
 * Format: <value>.<signature>
 */
export function signSession(value: string): string {
  const secret = getSessionSecret();
  const sig = crypto
    .createHmac("sha256", secret)
    .update(value)
    .digest("hex");
  return `${value}.${sig}`;
}

/**
 * Verifies a signed session value. Returns the original value or null if invalid.
 */
export function verifySession(signed: string): string | null {
  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) return null;
  const value = signed.substring(0, lastDot);
  const expected = signSession(value);
  // Constant-time comparison to prevent timing attacks
  try {
    const a = Buffer.from(signed);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;
    // Auth sessions embed an expiry: auth:<user>:<uuid>:<expMs>
    if (value.startsWith("auth:")) {
      const exp = Number(value.split(":")[3]);
      if (!Number.isFinite(exp) || exp < Date.now()) return null;
    }
    return value;
  } catch {
    return null;
  }
}

export interface AuthSession {
  username: string;
  sid: string;
  issuedAt: number;
}

const SESSION_EPOCH_KEY = "session:epoch";
const REVOKED_PREFIX = "session:revoked:";

/** Splits a verified `auth:<user>:<sid>:<expMs>` value; null for any other signed value. */
export function parseAuthSession(value: string | null): AuthSession | null {
  if (!value || !value.startsWith("auth:")) return null;
  const [, username, sid, exp] = value.split(":");
  if (!username || !sid) return null;
  return { username, sid, issuedAt: Number(exp) - SESSION_MAX_AGE_SECONDS * 1000 };
}

/**
 * The signed-in session from the cookie, or null. Besides the signature and expiry,
 * a session must not have been signed out (logout) or predate "sign out everywhere".
 */
export async function currentSession(): Promise<AuthSession | null> {
  const cookie = (await cookies()).get("copilot_session");
  const session = cookie ? parseAuthSession(verifySession(cookie.value)) : null;
  if (!session) return null;
  const rows = await db.appMeta.findMany({
    where: { key: { in: [SESSION_EPOCH_KEY, `${REVOKED_PREFIX}${session.sid}`] } },
  });
  for (const row of rows) {
    if (row.key !== SESSION_EPOCH_KEY) return null; // this session was signed out
    if (session.issuedAt < Number(row.value)) return null; // signed in before "sign out everywhere"
  }
  return session;
}

/** Signs out one session server-side, so a copied cookie stops working too. */
export async function revokeSession(sid: string) {
  const key = `${REVOKED_PREFIX}${sid}`;
  await db.appMeta.upsert({ where: { key }, create: { key, value: "1" }, update: {} });
  // Revocations only matter until the cookie would have expired anyway
  await db.appMeta.deleteMany({
    where: {
      key: { startsWith: REVOKED_PREFIX },
      updatedAt: { lt: new Date(Date.now() - SESSION_MAX_AGE_SECONDS * 1000) },
    },
  });
}

/** Invalidates every session issued before now (all devices, including demo visitors). */
export async function revokeAllSessions() {
  const value = String(Date.now());
  await db.appMeta.upsert({ where: { key: SESSION_EPOCH_KEY }, create: { key: SESSION_EPOCH_KEY, value }, update: { value } });
}

/**
 * Middleware helper: Call at the top of any API route to enforce authentication.
 * Returns a 401 NextResponse if not authenticated, or null if auth is valid.
 * Next.js 16+ made cookies() async — this function is now async.
 */
export async function requireAuth(options?: { allowDemo?: boolean }): Promise<NextResponse | null> {
  try {
    // CSRF defence in depth: reject requests whose Origin doesn't match this host
    const h = await headers();
    const origin = h.get("origin");
    const host = h.get("x-forwarded-host") || h.get("host");
    if (origin && host) {
      let originHost = "";
      try {
        originHost = new URL(origin).host;
      } catch {}
      if (originHost !== host) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const session = await currentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Block demo sessions from querying or modifying real owner data
    if (session.username.toLowerCase() === "demo" && !options?.allowDemo) {
      return NextResponse.json(
        { error: "Demo users cannot access real accounts or live financial data." },
        { status: 403 }
      );
    }

    return null; // Auth passed
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/** Username of the current verified session (e.g. "demo"), or null. */
export async function getSessionUsername(): Promise<string | null> {
  try {
    return (await currentSession())?.username ?? null;
  } catch {
    return null;
  }
}

/**
 * Client IP for rate limiting. Prefers headers set by the platform edge (clients can't
 * forge these on Vercel); the raw X-Forwarded-For chain is client-controllable, so use its last hop only.
 */
export function clientIp(req: Request): string {
  const h = req.headers;
  const vercel = h.get("x-vercel-forwarded-for")?.split(",")[0].trim();
  if (vercel) return vercel;
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const chain = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return chain?.length ? chain[chain.length - 1] : "unknown";
}
