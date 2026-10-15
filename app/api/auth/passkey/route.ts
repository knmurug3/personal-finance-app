import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/apiError";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

/** Lists registered passkeys (never returns key material). */
export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;
  try {
    const passkeys = await db.passkey.findMany({
      select: { id: true, name: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ passkeys });
  } catch (error) {
    return apiError("Failed to load passkeys", error);
  }
}

export async function DELETE(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;
  try {
    const { id } = await req.json();
    if (typeof id !== "string") return NextResponse.json({ error: "id is required" }, { status: 400 });
    await db.passkey.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError("Failed to remove passkey", error);
  }
}
