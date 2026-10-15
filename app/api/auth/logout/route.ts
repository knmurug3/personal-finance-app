import { NextResponse } from "next/server";
import { currentSession, requireAuth, revokeAllSessions, revokeSession } from "@/lib/requireAuth";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

/**
 * Signs out this session server-side (a copied cookie stops working too).
 * `{ everywhere: true }` signs out every device; owner only, so demo visitors can't sign the owner out.
 */
export async function POST(req: Request) {
  const { everywhere } = await req.json().catch(() => ({} as { everywhere?: unknown }));
  try {
    if (everywhere === true) {
      const authError = await requireAuth();
      if (authError) return authError;
      await revokeAllSessions();
    } else {
      const session = await currentSession().catch(() => null);
      if (session) await revokeSession(session.sid);
    }
  } catch (error) {
    return apiError("Failed to sign out", error);
  }
  const response = NextResponse.json({ success: true });
  response.cookies.delete("copilot_session");
  return response;
}
