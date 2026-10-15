import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { apiError } from "@/lib/apiError";
import { cleanString, finiteNumber } from "@/lib/validate";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const accounts = await db.manualAccount.findMany();
    return NextResponse.json(accounts);
  } catch (error) {
    return apiError("Internal server error", error);
  }
}

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const body = await req.json();
    const { name, emoji, type, balance, notes } = body;

    if (type !== "asset" && type !== "liability") {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    const cleanName = cleanString(name, 100);
    if (!cleanName) return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    if (finiteNumber(balance) === null || Math.abs(balance) > 1e12) {
      return NextResponse.json({ error: "Invalid balance" }, { status: 400 });
    }
    if (notes != null && (typeof notes !== "string" || notes.length > 1000)) {
      return NextResponse.json({ error: "Invalid notes" }, { status: 400 });
    }

    const account = await db.manualAccount.create({
      data: { name: cleanName, emoji: cleanString(emoji, 16) || "💰", type, balance, notes: notes ?? null },
    });
    return NextResponse.json(account);
  } catch (error) {
    return apiError("Internal server error", error);
  }
}

export async function PUT(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const body = await req.json();
    const { id, name, emoji, type, balance, notes } = body;

    if (typeof id !== "string" || !id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    if (type !== undefined && type !== "asset" && type !== "liability") {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    if (balance !== undefined && (typeof balance !== "number" || !Number.isFinite(balance) || Math.abs(balance) > 1e12)) {
      return NextResponse.json({ error: "Invalid balance" }, { status: 400 });
    }
    if (name !== undefined && !cleanString(name, 100)) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
    if (notes != null && (typeof notes !== "string" || notes.length > 1000)) {
      return NextResponse.json({ error: "Invalid notes" }, { status: 400 });
    }

    const updateData: Prisma.ManualAccountUpdateInput = {};
    if (name !== undefined) updateData.name = cleanString(name, 100)!;
    if (emoji !== undefined) updateData.emoji = cleanString(emoji, 16) || "💰";
    if (type !== undefined) updateData.type = type;
    if (balance !== undefined) updateData.balance = balance;
    if (notes !== undefined) updateData.notes = notes;

    const account = await db.manualAccount.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json(account);
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

    await db.manualAccount.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError("Internal server error", error);
  }
}
