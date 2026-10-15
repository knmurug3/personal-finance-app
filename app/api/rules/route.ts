import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/apiError";
import { cleanString } from "@/lib/validate";
import { requireAuth } from "@/lib/requireAuth";
import { saveMerchantCategoryRule } from "@/lib/categorizer";

export const dynamic = "force-dynamic";

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const rules = await db.categoryRule.findMany();
    return NextResponse.json(rules);
  } catch (error) {
    return apiError("Internal server error", error);
  }
}

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const body = await req.json();
    const { merchantPattern, category } = body;

    const pattern = cleanString(merchantPattern, 100);
    const cat = cleanString(category, 50);
    if (!pattern) return NextResponse.json({ error: "Invalid merchantPattern" }, { status: 400 });
    if (!cat) return NextResponse.json({ error: "Invalid category" }, { status: 400 });

    if (pattern.length < 3) {
      return NextResponse.json({ error: "Pattern must be at least 3 characters" }, { status: 400 });
    }
    // Same behavior as creating a rule from a transaction: existing matches are recategorized too
    const saved = await saveMerchantCategoryRule(pattern, cat);
    if (!saved) return NextResponse.json({ error: "Invalid merchantPattern" }, { status: 400 });
    return NextResponse.json({ ...saved.rule, updated: saved.updated });
  } catch (error) {
    return apiError("Internal server error", error);
  }
}

export async function DELETE(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    await db.categoryRule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError("Internal server error", error);
  }
}
