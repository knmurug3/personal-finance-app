import type Anthropic from "@anthropic-ai/sdk";
import { isExpenseTransaction, isIncomeTransaction, isTransfer, categoryParts } from "@/lib/financeUtils";
import { computeBalances } from "@/lib/netWorth";
import { roundMoney, monthlyEquivalent } from "@/lib/money";
import { appToday } from "@/lib/appTime";
import type { AskSnapshot, AskTransaction } from "./data";

/**
 * Read-only tools the assistant can call. Every tool works on an in-memory
 * snapshot (the owner's data or the demo profile) and returns compact JSON,
 * so Claude sees only what a question needs and never touches the database.
 */

type ToolDef = Anthropic.Beta.BetaTool;

const TOOL_DEFS: ToolDef[] = [
  {
    name: "get_accounts",
    description:
      "Current balances for every connected account (checking, savings, credit cards, investments, loans) and manual assets/liabilities, plus net worth totals.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "spending_summary",
    description:
      "Total spending (and income) between two dates, grouped by category, merchant, or month. Excludes transfers and investment moves; refunds reduce spending. Use for questions like 'how much did I spend on food last month' or 'compare spending by month'.",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "Inclusive start, YYYY-MM-DD" },
        end_date: { type: "string", description: "Inclusive end, YYYY-MM-DD" },
        group_by: { type: "string", enum: ["category", "merchant", "month"] },
        category: { type: "string", description: "Optional: only this category (exact name, e.g. 'Food & Dining')" },
      },
      required: ["start_date", "end_date", "group_by"],
      additionalProperties: false,
    },
  },
  {
    name: "search_transactions",
    description:
      "Find individual transactions by merchant/name text, category, date range, or amount. Returns newest first (max 50). Amounts: positive = money out, negative = money in.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Case-insensitive text matched against name and merchant" },
        category: { type: "string" },
        start_date: { type: "string", description: "YYYY-MM-DD" },
        end_date: { type: "string", description: "YYYY-MM-DD" },
        min_amount: { type: "number", description: "Minimum absolute amount" },
        max_amount: { type: "number", description: "Maximum absolute amount" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_budgets",
    description: "Monthly budget limits per category with amount spent and remaining for a given month (default: current month).",
    input_schema: {
      type: "object",
      properties: { month: { type: "string", description: "YYYY-MM; defaults to the current month" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_recurring",
    description: "Active subscriptions and recurring bills with amounts, frequency and next due date.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_investments",
    description:
      "Portfolio across brokerages: total value, total return, allocation by asset type, value per brokerage, and top holdings by value (ticker, shares, value, gain).",
    input_schema: {
      type: "object",
      properties: { top: { type: "integer", minimum: 1, maximum: 50, description: "How many holdings to list (default 15)" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_net_worth_history",
    description: "Daily net worth snapshots between two dates (default: last 90 days), downsampled to at most 60 points.",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "YYYY-MM-DD" },
        end_date: { type: "string", description: "YYYY-MM-DD" },
      },
      additionalProperties: false,
    },
  },
];

// Stream tool inputs as generated; inputs are validated in runAskTool, not by the API
export const ASK_TOOLS: ToolDef[] = TOOL_DEFS.map((t) => ({ ...t, eager_input_streaming: true }));

// ── input validation (tool inputs are model output: never trust shape) ──────

class ToolInputError extends Error {}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function obj(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ToolInputError("input must be an object");
  return input as Record<string, unknown>;
}
function optStr(o: Record<string, unknown>, k: string, max = 120): string | undefined {
  const v = o[k];
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string" || v.length > max) throw new ToolInputError(`${k} must be a string`);
  return v;
}
function optNum(o: Record<string, unknown>, k: string): number | undefined {
  const v = o[k];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "number" || !Number.isFinite(v)) throw new ToolInputError(`${k} must be a number`);
  return v;
}
function date(o: Record<string, unknown>, k: string, endOfDay = false): Date | undefined {
  const v = optStr(o, k, 10);
  if (v === undefined) return undefined;
  if (!DATE_RE.test(v)) throw new ToolInputError(`${k} must be YYYY-MM-DD`);
  const d = new Date(`${v}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (Number.isNaN(d.getTime())) throw new ToolInputError(`${k} is not a real date`);
  return d;
}

const ymd = (d: Date) => d.toISOString().split("T")[0];
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function inRange(t: AskTransaction, start?: Date, end?: Date) {
  return (!start || t.date >= start) && (!end || t.date <= end);
}

// ── implementations ─────────────────────────────────────────────────────────

function getAccounts(s: AskSnapshot) {
  const totals = computeBalances(
    s.accounts.map((a) => ({ type: a.type, currentBalance: a.balance })),
    s.manualAccounts
  );
  return {
    ...totals,
    accounts: s.accounts.map((a) => ({
      name: a.mask ? `${a.name} ••${a.mask}` : a.name,
      institution: a.institution,
      type: a.subtype || a.type,
      balance: roundMoney(a.balance),
      owed: a.type === "credit" || a.type === "loan",
    })),
    manual: s.manualAccounts.map((m) => ({ name: m.name, type: m.type, balance: roundMoney(m.balance) })),
  };
}

function spendingSummary(s: AskSnapshot, input: unknown) {
  const o = obj(input);
  const start = date(o, "start_date");
  const end = date(o, "end_date", true);
  if (!start || !end) throw new ToolInputError("start_date and end_date are required");
  const groupBy = o.group_by;
  if (groupBy !== "category" && groupBy !== "merchant" && groupBy !== "month") {
    throw new ToolInputError("group_by must be category, merchant or month");
  }
  const category = optStr(o, "category");

  const txs = s.transactions.filter((t) => inRange(t, start, end));
  // Split transactions contribute each split to its own category
  const expenseParts = txs
    .filter((t) => isExpenseTransaction(t))
    .flatMap((t) => categoryParts(t).map((p) => ({ t, category: p.category, amount: p.amount })))
    .filter((p) => !category || p.category === category);
  const expenses = expenseParts.map((p) => ({ amount: p.amount }));
  const income = txs.filter((t) => isIncomeTransaction(t));

  const groups = new Map<string, { total: number; count: number }>();
  for (const p of expenseParts) {
    const key = groupBy === "category" ? p.category : groupBy === "merchant" ? p.t.merchant || p.t.name : ymd(p.t.date).slice(0, 7);
    const g = groups.get(key) || { total: 0, count: 0 };
    g.total += p.amount;
    g.count++;
    groups.set(key, g);
  }
  const rows = [...groups.entries()]
    .map(([key, g]) => ({ [groupBy]: key, total: roundMoney(Math.max(0, g.total)), transactions: g.count }))
    .sort((a, b) => (groupBy === "month" ? String(a.month).localeCompare(String(b.month)) : b.total - a.total));

  return {
    period: { start: ymd(start), end: ymd(end) },
    category: category ?? "all",
    total_spending: roundMoney(Math.max(0, sum(expenses.map((t) => t.amount)))),
    total_income: category ? undefined : roundMoney(Math.max(0, sum(income.map((t) => -t.amount)))),
    groups: rows.slice(0, 40),
    groups_truncated: rows.length > 40,
  };
}

function searchTransactions(s: AskSnapshot, input: unknown) {
  const o = obj(input);
  const q = optStr(o, "query")?.toLowerCase();
  const category = optStr(o, "category");
  const start = date(o, "start_date");
  const end = date(o, "end_date", true);
  const min = optNum(o, "min_amount");
  const max = optNum(o, "max_amount");
  const limit = Math.min(50, Math.max(1, Math.floor(optNum(o, "limit") ?? 25)));

  const matches = s.transactions
    .filter(
      (t) =>
        inRange(t, start, end) &&
        (!q || `${t.name} ${t.merchant ?? ""}`.toLowerCase().includes(q)) &&
        (!category || t.category === category || (t.splits ?? []).some((s) => s.category === category)) &&
        (min === undefined || Math.abs(t.amount) >= min) &&
        (max === undefined || Math.abs(t.amount) <= max)
    )
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    match_count: matches.length,
    sum_of_matches: roundMoney(sum(matches.map((t) => t.amount))),
    transactions: matches.slice(0, limit).map((t) => ({
      date: ymd(t.date),
      name: t.merchant || t.name,
      amount: roundMoney(t.amount),
      category: t.category,
      account: t.account,
      ...(t.pending ? { pending: true } : {}),
      ...(isTransfer(t.category, t.name) ? { transfer: true } : {}),
    })),
  };
}

function getBudgets(s: AskSnapshot, input: unknown) {
  const o = obj(input ?? {});
  const month = optStr(o, "month", 7) ?? appToday().monthKey;
  if (!/^\d{4}-\d{2}$/.test(month)) throw new ToolInputError("month must be YYYY-MM");
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1) - 1);

  const spentBy = new Map<string, number>();
  for (const t of s.transactions) {
    if (!inRange(t, start, end) || !isExpenseTransaction(t)) continue;
    for (const p of categoryParts(t)) spentBy.set(p.category, (spentBy.get(p.category) || 0) + p.amount);
  }
  const budgets = s.budgets.map((b) => {
    const spent = roundMoney(Math.max(0, spentBy.get(b.category) || 0));
    return {
      category: b.category,
      limit: b.monthlyLimit,
      spent,
      remaining: roundMoney(b.monthlyLimit - spent),
      percent_used: b.monthlyLimit > 0 ? Math.round((spent / b.monthlyLimit) * 100) : null,
    };
  });
  return {
    month,
    total_limit: roundMoney(sum(budgets.map((b) => b.limit))),
    total_spent: roundMoney(sum(budgets.map((b) => b.spent))),
    budgets,
  };
}

function getRecurring(s: AskSnapshot) {
  const monthly = s.subscriptions.map((x) => {
    return { ...x, amount: roundMoney(x.amount), monthly_equivalent: monthlyEquivalent(x.amount, x.frequency) };
  });
  return {
    count: monthly.length,
    total_per_month: roundMoney(sum(monthly.map((x) => x.monthly_equivalent))),
    items: monthly.sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate)),
  };
}

function getInvestments(s: AskSnapshot, input: unknown) {
  const o = obj(input ?? {});
  const top = Math.min(50, Math.max(1, Math.floor(optNum(o, "top") ?? 15)));
  const p = s.portfolio;
  if (!p) return { connected: false, note: "No investment accounts are connected." };
  return {
    total_value: p.totalValue,
    total_cost_basis: p.totalCost,
    total_return: p.totalGain,
    total_return_pct: Math.round(p.totalGainPct * 10000) / 100,
    note: "Prices are as of the brokerage's last update (usually daily), not live.",
    allocation: p.allocation.map((a) => ({ type: a.label, value: a.value, percent: Math.round(a.weight * 1000) / 10 })),
    by_brokerage: p.institutions,
    accounts_without_holdings_detail: p.unitemized.map((u) => ({ institution: u.institution, account: u.account, value: u.value })),
    concentrated_positions: p.concentrated.map((c) => ({ ticker: c.ticker, percent: Math.round(c.weight * 1000) / 10 })),
    holdings: p.positions.slice(0, top).map((x) => ({
      ticker: x.ticker,
      name: x.name,
      type: x.type,
      shares: x.quantity,
      value: x.value,
      gain: x.gain,
      gain_pct: x.gainPct === null ? null : Math.round(x.gainPct * 10000) / 100,
      percent_of_portfolio: Math.round(x.weight * 1000) / 10,
      held_at: [...new Set(x.accounts.map((a) => a.institution))],
    })),
    holdings_total_count: p.positions.length,
  };
}

function getNetWorthHistory(s: AskSnapshot, input: unknown) {
  const o = obj(input ?? {});
  const end = date(o, "end_date", true) ?? new Date();
  const start = date(o, "start_date") ?? new Date(end.getTime() - 90 * 86_400_000);
  const pts = s.netWorthHistory.filter((h) => {
    const d = new Date(`${h.date}T12:00:00Z`);
    return !Number.isNaN(d.getTime()) ? d >= start && d <= end : true;
  });
  const step = Math.max(1, Math.ceil(pts.length / 60));
  const sampled = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
  return {
    points: sampled,
    first: pts[0] ?? null,
    last: pts[pts.length - 1] ?? null,
    change: pts.length > 1 ? roundMoney(pts[pts.length - 1].netWorth - pts[0].netWorth) : null,
  };
}

/** Friendly status line shown in the chat while a tool runs. */
export const TOOL_LABELS: Record<string, string> = {
  get_accounts: "Checking balances",
  spending_summary: "Adding up spending",
  search_transactions: "Searching transactions",
  get_budgets: "Reviewing budgets",
  get_recurring: "Looking at recurring bills",
  get_investments: "Reviewing investments",
  get_net_worth_history: "Reading net worth history",
};

/** Runs a tool by name. Returns JSON text and whether it failed (sent back as is_error). */
export function runAskTool(snapshot: AskSnapshot, name: string, input: unknown): { content: string; isError: boolean } {
  try {
    let result: unknown;
    switch (name) {
      case "get_accounts":
        result = getAccounts(snapshot);
        break;
      case "spending_summary":
        result = spendingSummary(snapshot, input);
        break;
      case "search_transactions":
        result = searchTransactions(snapshot, input);
        break;
      case "get_budgets":
        result = getBudgets(snapshot, input);
        break;
      case "get_recurring":
        result = getRecurring(snapshot);
        break;
      case "get_investments":
        result = getInvestments(snapshot, input);
        break;
      case "get_net_worth_history":
        result = getNetWorthHistory(snapshot, input);
        break;
      default:
        return { content: `Unknown tool: ${name}`, isError: true };
    }
    return { content: JSON.stringify(result), isError: false };
  } catch (err) {
    if (err instanceof ToolInputError) return { content: `Invalid input: ${err.message}`, isError: true };
    throw err;
  }
}
