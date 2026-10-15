import { NextResponse } from "next/server";
import { apiError } from "@/lib/apiError";
import { requireAuth } from "@/lib/requireAuth";
import { isPushConfigured, sendPushToAll } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    if (!isPushConfigured()) {
      return NextResponse.json(
        { error: "Push is not configured (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)." },
        { status: 503 }
      );
    }

    const { title, body, url } = await req.json();
    if (!title || typeof title !== "string" || title.length > 200) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (body !== undefined && (typeof body !== "string" || body.length > 1000)) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const { configured, ...result } = await sendPushToAll({ title, body, url });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return apiError("Internal server error", error);
  }
}
