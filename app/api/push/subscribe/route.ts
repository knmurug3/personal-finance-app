import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/apiError";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const body = await req.json();
    const { endpoint, p256dh, auth } = body;

    let validEndpoint = false;
    try {
      validEndpoint = typeof endpoint === "string" && new URL(endpoint).protocol === "https:" && endpoint.length <= 2048;
    } catch {}
    if (!validEndpoint || typeof p256dh !== "string" || typeof auth !== "string" || p256dh.length > 256 || auth.length > 256) {
      return NextResponse.json({ error: "Missing subscription fields" }, { status: 400 });
    }

    const sub = await db.pushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, p256dh, auth },
      update: { p256dh, auth },
    });

    return NextResponse.json(sub);
  } catch (error) {
    return apiError("Internal server error", error);
  }
}

// The browser needs the VAPID public key to create a subscription.
export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;

  const publicKey = process.env.VAPID_PUBLIC_KEY || null;
  return NextResponse.json({ configured: Boolean(publicKey && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT), publicKey });
}

export async function DELETE(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { endpoint } = await req.json();
    if (typeof endpoint !== "string") {
      return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
    }
    await db.pushSubscription.deleteMany({ where: { endpoint } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError("Internal server error", error);
  }
}
