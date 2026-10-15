import { NextResponse } from "next/server";
import * as crypto from "crypto";
import { setSessionCookie } from "@/lib/passkey";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/requireAuth";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export const dynamic = "force-dynamic";

/** Records one attempt for this IP in the current window and returns the window's total. */
async function countAttempt(ip: string): Promise<number> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + WINDOW_MS);
  // Start a fresh window once the old one has passed
  await db.loginAttempt.updateMany({ where: { ip, resetAt: { lte: now } }, data: { count: 0, resetAt } });
  const upsert = () =>
    db.loginAttempt.upsert({
      where: { ip },
      create: { ip, count: 1, resetAt },
      update: { count: { increment: 1 } },
    });
  // Two first-ever attempts racing can both try to create the row; the loser retries as an update
  const row = await upsert().catch(upsert);
  return row.count;
}

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    // Count the attempt before checking credentials, atomically, so a burst of
    // parallel requests can't all slip past the limit before any failure is recorded.
    if ((await countAttempt(ip)) > MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 }
      );
    }

    const { username, password } = await req.json();

    const cleanUser = (typeof username === "string" ? username : "").trim().toLowerCase();
    const cleanPass = (typeof password === "string" ? password : "").trim();

    // Dedicated Demo Account credentials (safe guest mode)
    const isDemoLogin = cleanUser === "demo" && cleanPass === "demo123";

    const expectedUser = process.env.AUTH_USERNAME;
    const expectedPass = process.env.AUTH_PASSWORD;

    let userMatch = false;
    let passMatch = false;

    if (isDemoLogin) {
      userMatch = true;
      passMatch = true;
    } else if (expectedUser && expectedPass) {
      // Constant-time comparison for primary owner login
      const bufUser = Buffer.from(cleanUser);
      const bufExpUser = Buffer.from(expectedUser.toLowerCase().trim());
      userMatch = bufUser.length === bufExpUser.length && crypto.timingSafeEqual(bufUser, bufExpUser);

      const bufPass = Buffer.from(cleanPass);
      const bufExpPass = Buffer.from(expectedPass.trim());
      passMatch = bufPass.length === bufExpPass.length && crypto.timingSafeEqual(bufPass, bufExpPass);
    }

    if (!userMatch || !passMatch) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // The owner signing in clears this IP's failures. A demo sign-in only gives back its own
    // attempt; it must not reset the count, or the public demo login would unlock unlimited guesses.
    await (isDemoLogin
      ? db.loginAttempt.updateMany({ where: { ip, count: { gt: 0 } }, data: { count: { decrement: 1 } } })
      : db.loginAttempt.deleteMany({ where: { ip } })
    ).catch(() => {});

    const actualUser = isDemoLogin ? "demo" : (expectedUser || "user");

    const response = NextResponse.json({
      success: true,
      username: actualUser,
      isDemo: isDemoLogin,
    });
    setSessionCookie(response, actualUser);

    return response;
  } catch (error: any) {
    console.error("Login error:", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { error: isProd ? "Login failed" : `Login failed: ${error?.message || String(error)}` },
      { status: 500 }
    );
  }
}
