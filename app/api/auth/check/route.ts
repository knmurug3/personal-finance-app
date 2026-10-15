import { NextResponse } from "next/server";
import { currentSession } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await currentSession();
    if (!session) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      username: session.username,
      isDemo: session.username.toLowerCase() === "demo",
    });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
