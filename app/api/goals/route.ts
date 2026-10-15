import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/apiError";
import { requireAuth } from "@/lib/requireAuth";
import { cleanString, optionalDate } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const goals = await db.goal.findMany();
    return NextResponse.json(goals);
  } catch (error) {
    return apiError("Internal server error", error);
  }
}

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const body = await req.json();
    const { name, emoji, targetAmount, targetDate, category } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Goal name is required.' }, { status: 400 });
    }

    if (typeof targetAmount !== "number" || !Number.isFinite(targetAmount) || targetAmount <= 0) {
      return NextResponse.json({ error: "Invalid targetAmount" }, { status: 400 });
    }
    const cleanName = cleanString(name, 100);
    if (!cleanName) return NextResponse.json({ error: "Goal name must be 1–100 characters." }, { status: 400 });
    const date = optionalDate(targetDate);
    if (date === "invalid") return NextResponse.json({ error: "Invalid target date." }, { status: 400 });

    const goal = await db.goal.create({
      data: {
        name: cleanName,
        emoji: cleanString(emoji, 16) || "🎯",
        targetAmount,
        targetDate: date ?? null,
        category: cleanString(category, 50) || "Savings",
      },
    });
    return NextResponse.json(goal);
  } catch (error) {
    return apiError("Internal server error", error);
  }
}

export async function PUT(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const body = await req.json();
    const { id, name, emoji, targetAmount, currentAmount, targetDate, completed } = body;

    if (typeof id !== "string" || !id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    if (
      targetAmount !== undefined &&
      (typeof targetAmount !== "number" || !Number.isFinite(targetAmount) || targetAmount <= 0)
    ) {
      return NextResponse.json({ error: "Invalid targetAmount" }, { status: 400 });
    }

    if (currentAmount !== undefined && (typeof currentAmount !== "number" || !Number.isFinite(currentAmount))) {
      return NextResponse.json({ error: "Invalid currentAmount" }, { status: 400 });
    }

    const date = optionalDate(targetDate);
    if (date === "invalid") return NextResponse.json({ error: "Invalid target date." }, { status: 400 });
    if (name !== undefined && !cleanString(name, 100)) {
      return NextResponse.json({ error: "Goal name must be 1–100 characters." }, { status: 400 });
    }
    if (completed !== undefined && typeof completed !== "boolean") {
      return NextResponse.json({ error: "Invalid completed flag" }, { status: 400 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = cleanString(name, 100);
    if (emoji !== undefined) updateData.emoji = cleanString(emoji, 16) || "🎯";
    if (targetAmount !== undefined) updateData.targetAmount = targetAmount;
    if (currentAmount !== undefined) updateData.currentAmount = currentAmount;
    if (date !== undefined) updateData.targetDate = date;
    if (completed !== undefined) updateData.completed = completed;

    const goal = await db.goal.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json(goal);
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

    await db.goal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError("Internal server error", error);
  }
}
