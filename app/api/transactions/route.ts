import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { saveMerchantCategoryRule } from "@/lib/categorizer";
import { mapPlaidCategoryToStandard } from "@/lib/categoryMapper";
import { apiError } from "@/lib/apiError";
import { requireAuth } from "@/lib/requireAuth";
import { cleanString, cleanTags } from "@/lib/validate";
import { findDuplicatePendingIds } from "@/lib/financeUtils";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const accountId = searchParams.get("accountId");
    const query = searchParams.get("query");
    const needsReviewOnly = searchParams.get("needsReviewOnly");

    // Pagination: default 200 per page, up to 1000 when the client pages through everything
    const page = Math.max(0, parseInt(searchParams.get("page") || "0") || 0);
    const PAGE_SIZE = Math.min(1000, Math.max(1, parseInt(searchParams.get("pageSize") || "200") || 200));

    const where: Prisma.TransactionWhereInput = {};
    if (category && category !== "ALL") {
      where.category = category;
    }
    if (accountId && accountId !== "ALL") {
      where.accountId = accountId;
    }
    if (needsReviewOnly === "true") {
      where.reviewed = false;
    }
    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { merchantName: { contains: query, mode: "insensitive" } },
      ];
    }

    // Hide pending rows that already posted. Computed over all rows (not just this page)
    // so pagination and totals stay consistent.
    const lite = await db.transaction.findMany({
      select: { id: true, accountId: true, amount: true, date: true, name: true, merchantName: true, pending: true },
    });
    const hiddenIds = Array.from(findDuplicatePendingIds(lite));
    if (hiddenIds.length > 0) where.id = { notIn: hiddenIds };

    const transactions = (await db.transaction.findMany({
      where,
      orderBy: [
        { date: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: PAGE_SIZE,
      skip: page * PAGE_SIZE,
      include: {
        account: true,
        splits: true,
      },
    })).map((tx) => ({
      ...tx,
      category: tx.category || mapPlaidCategoryToStandard("", tx.name),
    }));

    const unreviewedCount = await db.transaction.count({
      where: { reviewed: false, ...(hiddenIds.length > 0 ? { id: { notIn: hiddenIds } } : {}) },
    });

    const total = await db.transaction.count({ where });

    return NextResponse.json({
      transactions,
      unreviewedCount,
      total,
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (error) {
    return apiError("Failed to fetch transactions", error);
  }
}

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const body = await req.json();
    const { name, amount, category, date, accountId, tags } = body;

    if (typeof name !== "string" || !name.trim() || amount === undefined || typeof accountId !== "string") {
      return NextResponse.json(
        { error: "Name, amount, and accountId are required." },
        { status: 400 }
      );
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < -1_000_000 || parsedAmount > 1_000_000) {
      return NextResponse.json({ error: "Invalid amount value." }, { status: 400 });
    }

    const parsedDate = date ? new Date(date) : new Date();
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Invalid date format." }, { status: 400 });
    }

    // Verify accountId exists
    const account = await db.account.findUnique({ where: { id: accountId } });
    if (!account) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    const transaction = await db.transaction.create({
      data: {
        accountId,
        name: String(name).substring(0, 200),
        amount: parsedAmount,
        category: cleanString(category, 100) || "General",
        tags: cleanTags(tags ?? []) ?? [],
        date: parsedDate,
        reviewed: true,
      },
    });

    return NextResponse.json(transaction);
  } catch (error) {
    return apiError("Failed to create transaction", error);
  }
}

export async function PUT(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const body = await req.json();

    if (body.action === "mark_all_reviewed") {
      await db.transaction.updateMany({
        where: { reviewed: false },
        data: { reviewed: true },
      });
      return NextResponse.json({ success: true, message: "Marked all transactions as reviewed." });
    }

    const { id, name, merchantName, amount, date, category, reviewed, tags, splits, createRule, merchantPattern } = body;

    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "Transaction ID is required" }, { status: 400 });
    }

    const updateData: any = {};
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) return NextResponse.json({ error: "Invalid name" }, { status: 400 });
      updateData.name = name.trim().substring(0, 200);
    }
    if (merchantName !== undefined) {
      if (merchantName !== null && (typeof merchantName !== "string" || merchantName.length > 200)) {
        return NextResponse.json({ error: "Invalid merchantName" }, { status: 400 });
      }
      updateData.merchantName = merchantName;
    }
    if (amount !== undefined) {
      const parsed = typeof amount === "number" ? amount : parseFloat(amount);
      if (!Number.isFinite(parsed) || Math.abs(parsed) > 1_000_000) {
        return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
      }
      updateData.amount = parsed;
    }
    if (date !== undefined) {
      const parsed = typeof date === "string" ? new Date(date) : new Date(NaN);
      if (isNaN(parsed.getTime())) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      updateData.date = parsed;
    }
    if (category !== undefined) {
      if (typeof category !== "string" || !category.trim() || category.length > 100) {
        return NextResponse.json({ error: "Invalid category" }, { status: 400 });
      }
      updateData.category = category.trim();
    }
    if (reviewed !== undefined) {
      if (typeof reviewed !== "boolean") {
        return NextResponse.json({ error: "Invalid reviewed flag" }, { status: 400 });
      }
      updateData.reviewed = reviewed;
    }
    if (tags !== undefined) {
      const clean = cleanTags(tags);
      if (!clean) return NextResponse.json({ error: "Tags must be up to 20 short text labels" }, { status: 400 });
      updateData.tags = clean;
    }

    if (splits && Array.isArray(splits)) {
      const badSplit =
        splits.length > 10 ||
        splits.some(
          (s: any) =>
            typeof s?.category !== "string" ||
            !s.category.trim() ||
            s.category.length > 100 ||
            !Number.isFinite(parseFloat(s.amount)) ||
            parseFloat(s.amount) <= 0 ||
            (s.notes != null && (typeof s.notes !== "string" || s.notes.length > 500))
        );
      if (badSplit) {
        return NextResponse.json({ error: "Invalid splits" }, { status: 400 });
      }
      if (splits.length > 0) {
        // Splits must account for the whole transaction
        const current = await db.transaction.findUnique({ where: { id }, select: { amount: true } });
        if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const total = Math.abs(updateData.amount ?? current.amount);
        const sum = splits.reduce((acc: number, s: any) => acc + parseFloat(s.amount), 0);
        if (Math.abs(sum - total) > 0.01) {
          return NextResponse.json(
            { error: `Split amounts add up to $${sum.toFixed(2)} but the transaction is $${total.toFixed(2)}` },
            { status: 400 }
          );
        }
      }
      await db.transactionSplit.deleteMany({
        where: { transactionId: id },
      });

      if (splits.length > 0) {
        await db.transactionSplit.createMany({
          data: splits.map((s: any) => ({
            transactionId: id,
            category: s.category,
            amount: parseFloat(s.amount),
            notes: s.notes || null,
          })),
        });
      }
    }

    const updatedTx = await db.transaction.update({
      where: { id },
      data: updateData,
      include: {
        account: true,
        splits: true,
      },
    });

    if (createRule && typeof merchantPattern === "string" && merchantPattern.length <= 100 && typeof category === "string") {
      await saveMerchantCategoryRule(merchantPattern, category);
    }

    return NextResponse.json(updatedTx);
  } catch (error) {
    return apiError("Failed to update transaction", error);
  }
}
