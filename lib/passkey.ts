import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import * as crypto from "crypto";
import { signSession, verifySession, SESSION_MAX_AGE_SECONDS } from "@/lib/requireAuth";

const CHALLENGE_COOKIE = "webauthn_challenge";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * Relying party = the host the app is served from. Set WEBAUTHN_RP_ID and WEBAUTHN_ORIGIN in
 * production so passkeys never depend on request headers. Without them, X-Forwarded-* is only
 * trusted on Vercel (its edge sets them), and production always expects https.
 */
export async function relyingParty() {
  const h = await headers();
  const forwarded = process.env.VERCEL ? h.get("x-forwarded-host") : null;
  const host = (forwarded || h.get("host") || "localhost").split(",")[0].trim();
  const hostname = host.split(":")[0];
  const proto =
    process.env.NODE_ENV === "production"
      ? "https"
      : (process.env.VERCEL && h.get("x-forwarded-proto")) || (hostname === "localhost" ? "http" : "https");
  return {
    rpID: process.env.WEBAUTHN_RP_ID || hostname,
    origin: process.env.WEBAUTHN_ORIGIN || `${proto}://${host}`,
    rpName: "Personal Finance",
  };
}

/** Stores the challenge in a short-lived, HMAC-signed, httpOnly cookie (no DB round-trip). */
export function setChallenge(res: NextResponse, purpose: "register" | "login", challenge: string) {
  const value = signSession(`wa:${purpose}:${challenge}:${Date.now() + CHALLENGE_TTL_MS}`);
  res.cookies.set(CHALLENGE_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: CHALLENGE_TTL_MS / 1000,
    path: "/api/auth/passkey",
  });
}

export async function readChallenge(purpose: "register" | "login"): Promise<string | null> {
  const raw = (await cookies()).get(CHALLENGE_COOKIE)?.value;
  if (!raw) return null;
  const value = verifySession(raw);
  if (!value) return null;
  const [tag, p, challenge, exp] = value.split(":");
  if (tag !== "wa" || p !== purpose || !challenge || Number(exp) < Date.now()) return null;
  return challenge;
}

export function clearChallenge(res: NextResponse) {
  res.cookies.set(CHALLENGE_COOKIE, "", { maxAge: 0, path: "/api/auth/passkey" });
}

/** Issues the signed `copilot_session` cookie used by every authenticated route. */
export function setSessionCookie(res: NextResponse, username: string) {
  const expMs = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const token = signSession(`auth:${username}:${crypto.randomUUID()}:${expMs}`);
  res.cookies.set("copilot_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
}
