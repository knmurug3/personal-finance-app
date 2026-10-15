"use client";

import { useState } from "react";
import { checkedFetch, confirmAction } from "@/lib/notify";
import { categoryParts } from "@/lib/financeUtils";
import {
  Target,
  Edit2,
  Check,
  X,
  Plus,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  Gauge,
  Calendar,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { parseLocalDate, isSameMonth } from "@/lib/dateUtils";

interface BudgetCategory {
  id: string;
  category: string;
  emoji?: string;
  monthlyLimit: number;
  spent: number;
  remaining: number;
  percentage: number;
  /** Rollover (optional on demo data) */
  rollover?: boolean;
  rolloverAmount?: number;
  effectiveLimit?: number;
}

interface TransactionItem {
  id: string;
  name: string;
  merchantName?: string | null;
  amount: number;
  date: string;
  category: string;
  account?: {
    name: string;
  };
}

interface CopilotBudgetsProps {
  budgets: BudgetCategory[];
  transactions?: TransactionItem[];
  /** Merchants of active recurring bills (counted once, not extrapolated) */
  recurringMerchants?: string[];
  onUpdateBudget: () => void;
}

const PRESET_EMOJIS = ["🐶", "✈️", "🏋️", "🎮", "☕", "🏎️", "🩺", "🍿", "🎓", "🛒", "💼", "🐕", "🍔", "🏠", "🚗", "🛍️", "🎬", "⚡", "📈"];

const FIXED_CATEGORIES = new Set(["Housing", "Rent", "Utilities", "Insurance", "Bills", "Loans"]);

export function CopilotBudgets({
  budgets,
  transactions = [],
  recurringMerchants = [],
  onUpdateBudget,
}: CopilotBudgetsProps) {
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newLimit, setNewLimit] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // Expandable Category Drawer state
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // New Category Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [catName, setCatName] = useState("");
  const [catEmoji, setCatEmoji] = useState("🐶");
  const [catLimit, setCatLimit] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);

  // Calculate Monthly Spending Pace & Projection Velocity Gauge
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthProgressPct = Math.round((currentDay / daysInMonth) * 100);

  const totalSpentAll = budgets.reduce((acc, b) => acc + b.spent, 0);
  const limitOf = (b: BudgetCategory) => b.effectiveLimit ?? b.monthlyLimit;
  const totalLimitAll = budgets.reduce((acc, b) => acc + Math.max(0, limitOf(b)), 0);
  // Bills (rent, utilities, subscriptions) happen once a month: count them as-is and only
  // extrapolate everyday spending, otherwise rent on the 1st reads as "on pace for 5x rent".
  const budgetCategories = new Set(budgets.map((b) => b.category));
  const recurring = new Set(recurringMerchants.map((m) => m.toLowerCase().trim()));
  const fixedSpent = transactions
    .filter((t) => isSameMonth(t.date, now) && t.category !== "Income" && t.category !== "Transfers")
    .flatMap((t) =>
      categoryParts(t as any).map((p) => ({
        ...p,
        fixed:
          FIXED_CATEGORIES.has(p.category) ||
          recurring.has(((t as any).merchantName || t.name || "").toLowerCase().trim()),
      }))
    )
    .filter((p) => p.fixed && p.amount > 0 && budgetCategories.has(p.category))
    .reduce((s, p) => s + p.amount, 0);
  const variableSpent = Math.max(0, totalSpentAll - fixedSpent);
  const projectedMonthEndSpent = Math.round(
    Math.min(totalSpentAll, fixedSpent) + (currentDay > 0 ? (variableSpent / currentDay) * daysInMonth : 0)
  );

  const spentPercentageTotal = totalLimitAll > 0 ? Math.round((totalSpentAll / totalLimitAll) * 100) : 0;
  const projectedPct = totalLimitAll > 0 ? projectedMonthEndSpent / totalLimitAll : 0;
  const isOverPacing = projectedPct > 1;
  const isUnderPacing = projectedPct <= 0.9;

  const toggleExpand = (category: string) => {
    setExpandedCategory(expandedCategory === category ? null : category);
  };

  const startEdit = (e: React.MouseEvent, category: string, currentLimit: number) => {
    e.stopPropagation();
    setEditingCategory(category);
    setNewLimit(currentLimit.toString());
  };

  const saveBudget = async (category: string, emoji?: string) => {
    if (!newLimit || isNaN(Number(newLimit))) return;
    setLoading(true);
    try {
      const ok = await checkedFetch(
        "/api/budgets",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, emoji, monthlyLimit: parseFloat(newLimit) }),
        },
        "Couldn't save that budget."
      );
      if (!ok) return;
      setEditingCategory(null);
      onUpdateBudget();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleRollover = async (e: React.MouseEvent, b: BudgetCategory) => {
    e.stopPropagation();
    const ok = await checkedFetch(
      "/api/budgets",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: b.category, emoji: b.emoji, monthlyLimit: b.monthlyLimit, rollover: !b.rollover }),
      },
      "Couldn't change rollover."
    );
    if (ok) onUpdateBudget();
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName || !catLimit) return;
    setIsSubmitting(true);
    try {
      setError(null);
      const ok = await checkedFetch(
        "/api/budgets",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: catName, emoji: catEmoji || "📦", monthlyLimit: parseFloat(catLimit) }),
        },
        "Couldn't create that category."
      );
      if (!ok) return;
      setCatName("");
      setCatLimit("");
      setShowAddModal(false);
      onUpdateBudget();
    } catch (err: any) {
      setError(err.message || "Failed to create category");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (e: React.MouseEvent, category: string) => {
    e.stopPropagation();
    if (!(await confirmAction({ title: `Delete the "${category}" budget?`, confirmLabel: "Delete", destructive: true }))) return;
    try {
      const ok = await checkedFetch(
        `/api/budgets?category=${encodeURIComponent(category)}`,
        { method: "DELETE" },
        "Couldn't delete that category."
      );
      if (ok) onUpdateBudget();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-surface border border-white/[0.08] rounded-[22px] p-4 sm:p-6 shadow-card">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <h3 className="text-[20px] font-semibold tracking-tight text-white flex items-center gap-2">
            This Month
          </h3>
          <p className="text-label-2 text-[13px] mt-0.5">
            Real-time monthly budget targets & spending pace velocity
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 bg-sys-blue hover:bg-sys-blue/90 text-[#fff] font-bold px-3 py-1.5 rounded-xl text-xs transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Category</span>
        </button>
      </div>

      {/* Monthly Spending Pace & Velocity Gauge Card */}
      <div className="mt-6 bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Monthly Spending Pace
            </span>
          </div>

          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
              isUnderPacing
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : isOverPacing
                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
            }`}
          >
            {isUnderPacing ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>On Track</span>
              </>
            ) : isOverPacing ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Projected over budget</span>
              </>
            ) : (
              <>
                <Calendar className="w-3.5 h-3.5" />
                <span>Close to budget</span>
              </>
            )}
          </span>
        </div>

        {/* Velocity Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Day {currentDay} of {daysInMonth}</span>
            <span title="Bills counted once; everyday spending projected from your daily average">
              Projected: <strong className="text-white font-bold">{formatCurrency(projectedMonthEndSpent)}</strong>
              {totalLimitAll > 0 && <> of {formatCurrency(totalLimitAll)}</>}
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isUnderPacing
                  ? "bg-emerald-400"
                  : isOverPacing
                  ? "bg-rose-500"
                  : "bg-amber-400"
              }`}
              style={{ width: `${Math.min(spentPercentageTotal, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Category List */}
      <div className="mt-6 space-y-4">
        {budgets.map((b) => {
          // A split charge appears in each of its categories with just that portion
          const categoryTxs = transactions.flatMap((t) =>
            categoryParts(t as any)
              .filter((p) => p.category === b.category)
              .map((p) => ({ ...t, category: p.category, amount: p.amount, isSplitPart: (t as any).splits?.length > 0 }))
          );

          // Current month transactions in category (safely parsed without timezone shifts)
          const currentMonthCategoryTxs = categoryTxs.filter((t) => isSameMonth(t.date, now));

          // Calculate actual spent from current month transactions
          const calculatedSpent = currentMonthCategoryTxs.reduce(
            (sum, t) => sum + (t.amount > 0 && t.category !== "Income" && t.category !== "Transfers" ? t.amount : 0),
            0
          );

          const actualSpent = b.spent > 0 ? b.spent : Math.round(calculatedSpent * 100) / 100;
          const available = limitOf(b);
          const actualPercentage =
            available > 0 ? Math.min(Math.round((actualSpent / available) * 100), 100) : actualSpent > 0 ? 100 : 0;
          const carried = b.rolloverAmount ?? 0;

          const isOver = actualPercentage >= 100;
          const isWarning = actualPercentage >= 85 && actualPercentage < 100;
          const isExpanded = expandedCategory === b.category;

          return (
            <div
              key={b.id}
              className="bg-white/[0.05] border border-white/[0.08] hover:border-white/[0.16] rounded-2xl p-4 transition-all cursor-pointer group"
              onClick={() => toggleExpand(b.category)}
            >
              <div className="flex items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl shrink-0 p-2 bg-slate-900 border border-white/[0.08] rounded-xl">
                    {b.emoji || "📦"}
                  </span>
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-100 text-sm truncate flex items-center gap-2">
                      {b.category}
                      {currentMonthCategoryTxs.length > 0 && (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-medium">
                          {currentMonthCategoryTxs.length} charges
                        </span>
                      )}
                    </h4>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {formatCurrency(actualSpent)} of {formatCurrency(available)}
                      {b.rollover && Math.abs(carried) >= 1 && (
                        <span className={carried > 0 ? "text-sys-green" : "text-sys-red"}>
                          {" "}· {carried > 0 ? "+" : "−"}
                          {formatCurrency(Math.abs(carried))} rolled over
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {editingCategory === b.category ? (
                    <div className="flex items-center gap-1.5 bg-slate-900 p-1 border border-white/[0.16] rounded-xl" onClick={(e) => e.stopPropagation()}>
                      <span className="text-slate-400 text-xs pl-2">$</span>
                      <input
                        type="number"
                        value={newLimit}
                        onChange={(e) => setNewLimit(e.target.value)}
                        className="w-20 bg-transparent text-slate-100 text-xs focus:outline-none font-bold"
                        autoFocus
                      />
                      <button
                        onClick={() => saveBudget(b.category, b.emoji)}
                        disabled={loading}
                        aria-label="Save limit"
                        className="p-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingCategory(null)}
                        aria-label="Cancel"
                        className="p-1 bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => toggleRollover(e, b)}
                        aria-pressed={Boolean(b.rollover)}
                        className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition ${
                          b.rollover
                            ? "bg-sys-blue/15 text-sys-blue"
                            : "text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 hover:bg-slate-900"
                        }`}
                        title={b.rollover ? "Unspent money carries into next month. Click to turn off." : "Carry unspent money into next month"}
                      >
                        {b.rollover ? "Rollover on" : "Rollover"}
                      </button>
                      <button
                        onClick={(e) => startEdit(e, b.category, b.monthlyLimit)}
                        className="p-1.5 text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition rounded-lg hover:bg-slate-900"
                        title="Edit Limit"
                        aria-label={`Edit ${b.category} limit`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => handleDeleteCategory(e, b.category)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition rounded-lg hover:bg-slate-900"
                        title="Delete Category"
                        aria-label={`Delete ${b.category} budget`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="p-1.5 text-slate-500 group-hover:text-slate-300 transition">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isOver
                      ? "bg-rose-500"
                      : isWarning
                      ? "bg-amber-500"
                      : "bg-sys-green"
                  }`}
                  style={{ width: `${Math.min(actualPercentage, 100)}%` }}
                />
              </div>

              {/* Expandable Category Transaction List Drawer */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-white/[0.08] space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold uppercase tracking-wider pb-1">
                    <span>Recent Charges in {b.category}</span>
                    <span>Total This Month: {formatCurrency(actualSpent)}</span>
                  </div>

                  {currentMonthCategoryTxs.length > 0 ? (
                    currentMonthCategoryTxs.slice(0, 5).map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between text-xs py-1.5 px-2.5 bg-slate-900/60 rounded-xl"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-semibold text-slate-200 truncate">{tx.name}</span>
                          <span className="text-[10px] text-slate-500">• {tx.account?.name || "Account"}</span>
                        </div>
                        <span className="font-bold text-slate-100">
                          {formatCurrency(tx.amount)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500 italic py-2">
                      No charges in this category for the current period.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* CREATE NEW CATEGORY MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/[0.08] rounded-[22px] p-6 max-w-md w-full shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Create Custom Category
              </h4>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-500 hover:text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
            </div>
            
            {error && <div className="text-rose-400 text-xs bg-rose-500/10 p-2 rounded-lg">{error}</div>}

            <form onSubmit={handleCreateCategory} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pet Care / Coffee / Vacation"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] text-slate-100 px-3 py-2 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Select Emoji Icon</label>
                <div className="flex flex-wrap gap-2 bg-white/[0.05] border border-white/[0.08] p-2.5 rounded-xl max-h-32 overflow-y-auto">
                  {PRESET_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setCatEmoji(emoji)}
                      className={`text-lg p-1.5 rounded-lg transition ${
                        catEmoji === emoji
                          ? "bg-emerald-500/20 border border-emerald-500/40 scale-110"
                          : "hover:bg-slate-900"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Monthly Limit ($)</label>
                <input
                  type="number"
                  step="1"
                  required
                  placeholder="e.g. 350"
                  value={catLimit}
                  onChange={(e) => setCatLimit(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] text-slate-100 px-3 py-2 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="bg-white/[0.05] border border-white/[0.08] text-slate-400 px-4 py-2 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-sys-blue hover:bg-sys-blue/90 text-[#fff] font-bold px-4 py-2 rounded-xl"
                >
                  {isSubmitting ? "Creating..." : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
