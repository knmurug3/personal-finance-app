import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/apiError";
import { requireAuth } from "@/lib/requireAuth";
import { reportError } from "@/lib/errorReport";
import { cleanString } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** Recent grouped problems for the Health card. */
export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;
  try {
    const since = new Date(Date.now() - 7 * 86_400_000);
    const events = await db.errorEvent.findMany({
      where: { lastSeen: { gte: since } },
      orderBy: { lastSeen: "desc" },
      take: 20,
      select: { id: true, source: true, message: true, path: true, count: true, firstSeen: true, lastSeen: true },
    });
    return NextResponse.json({ events });
  } catch (error) {
    return apiError("Failed to load errors", error);
  }
}

/** Browser crash reports (owner sessions only, so demo visitors can't spam alerts). */
export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;
  const body = await req.json().catch(() => null);
  const message = cleanString(body?.message, 500);
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });
  await reportError({ source: "App", message, path: cleanString(body?.path, 200) ?? undefined });
  return NextResponse.json({ ok: true });
}

/** Clear the list once problems are dealt with. */
export async function DELETE() {
  const authError = await requireAuth();
  if (authError) return authError;
  await db.errorEvent.deleteMany({});
  return NextResponse.json({ ok: true });
}
