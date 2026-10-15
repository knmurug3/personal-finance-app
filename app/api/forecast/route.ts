import { NextResponse } from "next/server";
import { apiError } from "@/lib/apiError";
import { requireAuth } from "@/lib/requireAuth";
import { ownerForecast } from "@/lib/forecastData";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;
  try {
    const days = Math.min(90, Math.max(14, Number(new URL(req.url).searchParams.get("days")) || 60));
    return NextResponse.json(await ownerForecast(days));
  } catch (error) {
    return apiError("Failed to build forecast", error);
  }
}
