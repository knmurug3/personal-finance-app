"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  SlidersHorizontal,
  Plus,
  CheckCheck,
  Download,
  X,
  Scissors,
  Check,
  Tag,
  MoreHorizontal,
} from "lucide-react";
import { checkedFetch, confirmAction, notify } from "@/lib/notify";
import { formatCalendarDate, localISODate, calendarISODate } from "@/lib/dates";
import { getCategoryEmoji, STANDARD_CATEGORIES } from "@/lib/categoryEmoji";

interface Split {
  id?: string;
  category: string;
  amount: number;
  notes?: string | null;
}

export interface TxRow {
  id: string;
  name: string;
  merchantName?: string | null;
  amount: number; // positive = money out
  date: string;
  category: string;
  tags?: string[];
  pending: boolean;
  reviewed: boolean;
  splits?: Split[];
  accountId?: string;
  account?: { id?: string; name: string; mask?: string | null };
}

interface Props {
  transactions: TxRow[];
  accounts: { id: string; name: string; mask?: string | null }[];
  budgets?: { category: string; emoji?: string }[];
  unreviewedCount: number;
  onRefresh: () => void;
}

type Filter = "all" | "review" | "reviewed";
type Range = "all" | "month" | "30" | "90" | "custom";
const PAGE = 150;

const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const signed = (amount: number) => `${amount < 0 ? "+" : "−"}${usd(Math.abs(amount))}`;

/** "Today", "Yesterday", "Fri, Oct 3", or "Oct 3, 2025" for other years. */
function dayLabel(iso: string) {
  const today = localISODate();
  const yesterday = localISODate(new Date(Date.now() - 86_400_000));
  if (iso === today) return "Today";
  if (iso === yesterday) return "Yesterday";
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return formatCalendarDate(iso, sameYear ? { weekday: "short", month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

export function TransactionsView({ transactions, accounts, budgets = [], unreviewedCount, onRefresh }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<Range>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [accountFilter, setAccountFilter] = useState("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [reviewedOverride, setReviewedOverride] = useState<Record<string, boolean>>({});
  const [sheet, setSheet] = useState<{ mode: "edit"; tx: TxRow } | { mode: "new" } | null>(null);

  // Reset optimistic flags whenever fresh data arrives
  useEffect(() => setReviewedOverride({}), [transactions]);
  useEffect(() => setLimit(PAGE), [filter, search, range, categoryFilter, accountFilter, customStart, customEnd]);

  const emojiMap = useMemo(() => Object.fromEntries(budgets.filter((b) => b.emoji).map((b) => [b.category, b.emoji!])), [budgets]);
  const categories = useMemo(
    () => [...new Set(["Income", "Transfers", ...budgets.map((b) => b.category), ...STANDARD_CATEGORIES])],
    [budgets]
  );
  const isReviewed = (tx: TxRow) => reviewedOverride[tx.id] ?? tx.reviewed;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const today = localISODate();
    const cutoff = (days: number) => localISODate(new Date(Date.now() - days * 86_400_000));
    // Newest first regardless of input order, so each day forms exactly one group
    const sorted = [...transactions].sort((a, b) => calendarISODate(b.date).localeCompare(calendarISODate(a.date)));
    return sorted.filter((tx) => {
      const day = calendarISODate(tx.date);
      if (range === "month" && day.slice(0, 7) !== today.slice(0, 7)) return false;
      if (range === "30" && day < cutoff(30)) return false;
      if (range === "90" && day < cutoff(90)) return false;
      if (range === "custom" && ((customStart && day < customStart) || (customEnd && day > customEnd))) return false;
      if (categoryFilter !== "ALL" && tx.category !== categoryFilter && !(tx.splits ?? []).some((s) => s.category === categoryFilter)) return false;
      if (accountFilter !== "ALL" && (tx.accountId ?? tx.account?.id) !== accountFilter) return false;
      // Rows toggled this session stay put so the list doesn't jump
      if (reviewedOverride[tx.id] === undefined) {
        if (filter === "review" && tx.reviewed) return false;
        if (filter === "reviewed" && !tx.reviewed) return false;
      }
      if (!q) return true;
      return (
        tx.name.toLowerCase().includes(q) ||
        (tx.merchantName ?? "").toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q) ||
        (tx.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [transactions, search, range, customStart, customEnd, categoryFilter, accountFilter, filter, reviewedOverride]);

  const totals = useMemo(() => {
    let moneyIn = 0;
    let moneyOut = 0;
    for (const t of filtered) {
      if (t.category === "Transfers") continue;
      if (t.amount < 0) moneyIn += -t.amount;
      else moneyOut += t.amount;
    }
    return { moneyIn, moneyOut };
  }, [filtered]);

  const groups = useMemo(() => {
    const out: { day: string; rows: TxRow[]; net: number }[] = [];
    for (const tx of filtered.slice(0, limit)) {
      const day = calendarISODate(tx.date);
      const g = out[out.length - 1];
      if (g && g.day === day) {
        g.rows.push(tx);
        g.net += -tx.amount;
      } else out.push({ day, rows: [tx], net: -tx.amount });
    }
    return out;
  }, [filtered, limit]);

  const toggleReviewed = async (tx: TxRow) => {
    const next = !isReviewed(tx);
    setReviewedOverride((m) => ({ ...m, [tx.id]: next }));
    const ok = await checkedFetch(
      "/api/transactions",
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: tx.id, reviewed: next }) },
      "Couldn't update review status."
    );
    if (!ok) setReviewedOverride((m) => ({ ...m, [tx.id]: !next }));
    else onRefresh();
  };

  const markAllReviewed = async () => {
    setShowMenu(false);
    if (!unreviewedCount) return;
    if (!(await confirmAction({ title: `Mark all ${unreviewedCount} transactions as reviewed?`, confirmLabel: "Mark Reviewed" }))) return;
    const ok = await checkedFetch(
      "/api/transactions",
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mark_all_reviewed" }) },
      "Couldn't mark everything reviewed."
    );
    if (ok) {
      notify("All transactions marked reviewed.", "success");
      onRefresh();
    }
  };

  const exportCSV = () => {
    setShowMenu(false);
    if (!filtered.length) return;
    const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = filtered.map((tx) =>
      [
        calendarISODate(tx.date),
        q(tx.merchantName || tx.name),
        q(tx.category),
        q((tx.tags ?? []).join("; ")),
        q(tx.account?.name ?? ""),
        (-tx.amount).toFixed(2),
        isReviewed(tx) ? "Reviewed" : "Needs review",
      ].join(",")
    );
    const blob = new Blob([["Date,Merchant,Category,Tags,Account,Amount,Status", ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `transactions_${localISODate()}.csv` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const activeFilterCount =
    (range !== "all" ? 1 : 0) + (categoryFilter !== "ALL" ? 1 : 0) + (accountFilter !== "ALL" ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex bg-white/[0.08] rounded-[10px] p-0.5 text-[13px] font-medium self-start" role="tablist" aria-label="Review filter">
          {(
            [
              ["all", "All"],
              ["review", "To Review"],
              ["reviewed", "Reviewed"],
            ] as [Filter, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={filter === k}
              onClick={() => {
                setReviewedOverride({});
                setFilter(k);
              }}
              className={`px-3.5 py-1.5 rounded-[8px] transition flex items-center gap-1.5 ${filter === k ? "bg-surface-3 shadow-sm" : "text-label-2"}`}
            >
              {label}
              {k === "review" && unreviewedCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-sys-blue text-[#fff] text-[11px] font-semibold flex items-center justify-center">
                  {unreviewedCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 flex items-center gap-2">
          <label className="flex-1 flex items-center gap-2 rounded-[10px] bg-white/[0.08] px-3 py-2">
            <Search className="w-4 h-4 text-label-2 shrink-0" />
            <span className="sr-only">Search transactions</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search merchant, category or #tag"
              className="flex-1 min-w-0 bg-transparent text-[15px] placeholder:text-label-3 !shadow-none !border-0"
            />
            {search && (
              <button onClick={() => setSearch("")} aria-label="Clear search" className="text-label-3 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </label>
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-label="Filters"
            className={`relative w-9 h-9 rounded-[10px] flex items-center justify-center transition ${
              showFilters || activeFilterCount ? "bg-sys-blue/15 text-sys-blue" : "bg-white/[0.08] text-label-2 hover:text-white"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-sys-blue text-[#fff] text-[10px] font-semibold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMenu((v) => !v)}
              aria-expanded={showMenu}
              aria-label="More actions"
              className="w-9 h-9 rounded-[10px] flex items-center justify-center bg-white/[0.08] text-label-2 hover:text-white transition"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} aria-hidden="true" />
                <div role="menu" className="absolute right-0 mt-2 z-40 w-60 liquid-glass rounded-2xl p-1.5 text-[15px]">
                  <MenuItem icon={<Plus className="w-4 h-4" />} label="Add Transaction" onClick={() => { setShowMenu(false); setSheet({ mode: "new" }); }} />
                  <MenuItem icon={<CheckCheck className="w-4 h-4" />} label={`Mark All Reviewed${unreviewedCount ? ` (${unreviewedCount})` : ""}`} onClick={markAllReviewed} disabled={!unreviewedCount} />
                  <MenuItem icon={<Download className="w-4 h-4" />} label="Export CSV" onClick={exportCSV} disabled={!filtered.length} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 view-enter">
          <Field label="Date">
            <select value={range} onChange={(e) => setRange(e.target.value as Range)} className="select-apple">
              <option value="all">All time</option>
              <option value="month">This month</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="custom">Custom range…</option>
            </select>
          </Field>
          <Field label="Category">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="select-apple">
              <option value="ALL">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {getCategoryEmoji(c, emojiMap)} {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Account">
            <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className="select-apple">
              <option value="ALL">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.mask ? ` ••${a.mask}` : ""}
                </option>
              ))}
            </select>
          </Field>
          {range === "custom" && (
            <>
              <Field label="From">
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="select-apple" />
              </Field>
              <Field label="To">
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="select-apple" />
              </Field>
            </>
          )}
          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setRange("all");
                setCategoryFilter("ALL");
                setAccountFilter("ALL");
                setCustomStart("");
                setCustomEnd("");
              }}
              className="text-[14px] text-sys-blue font-medium justify-self-start self-end pb-2"
            >
              Reset filters
            </button>
          )}
        </div>
      )}

      <p className="text-[13px] text-label-2 px-1" aria-live="polite">
        {filtered.length} transaction{filtered.length === 1 ? "" : "s"} · In <span className="text-sys-green">{usd(totals.moneyIn)}</span> · Out{" "}
        {usd(totals.moneyOut)}
      </p>

      {/* Grouped list */}
      {groups.length === 0 ? (
        <div className="card p-10 text-center text-[15px] text-label-2">No transactions match.</div>
      ) : (
        // No overflow clipping here: it would break the sticky day headers. Round the ends instead.
        <div className="card [&>section:first-child>header]:rounded-t-[22px] [&>section:last-child_li:last-child>div]:rounded-b-[22px] [&>button:last-child]:rounded-b-[22px]">
          {groups.map((g) => (
            <section key={g.day} aria-label={dayLabel(g.day)}>
              <header className="sticky top-[calc(env(safe-area-inset-top,0px)+56px)] md:top-[68px] z-10 flex items-center justify-between px-4 py-1.5 text-[13px] font-semibold text-label-2 bg-surface/90 backdrop-blur-md border-b-[0.5px] border-white/[0.08]">
                <span>{dayLabel(g.day)}</span>
                <span className={`tabular-nums ${g.net > 0 ? "text-sys-green" : ""}`}>{g.net > 0 ? "+" : g.net < 0 ? "−" : ""}{usd(Math.abs(g.net))}</span>
              </header>
              <ul>
                {g.rows.map((tx) => (
                  <Row
                    key={tx.id}
                    tx={tx}
                    reviewed={isReviewed(tx)}
                    emoji={getCategoryEmoji(tx.category, emojiMap)}
                    onOpen={() => setSheet({ mode: "edit", tx })}
                    onToggleReviewed={() => toggleReviewed(tx)}
                  />
                ))}
              </ul>
            </section>
          ))}
          {filtered.length > limit && (
            <button onClick={() => setLimit((l) => l + PAGE)} className="w-full py-3 text-[15px] font-medium text-sys-blue hover:bg-white/[0.04] transition">
              Show {Math.min(PAGE, filtered.length - limit)} more
            </button>
          )}
        </div>
      )}

      {sheet && (
        <TransactionSheet
          mode={sheet.mode}
          tx={sheet.mode === "edit" ? sheet.tx : undefined}
          accounts={accounts}
          categories={categories}
          emojiMap={emojiMap}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-white/[0.08] disabled:opacity-40 transition"
    >
      <span className="text-label-2">{icon}</span>
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-label-2 mb-1">{label}</span>
      {children}
    </label>
  );
}

/** One transaction. Touch: swipe right = toggle reviewed, swipe left = edit. */
function Row({
  tx,
  reviewed,
  emoji,
  onOpen,
  onToggleReviewed,
}: {
  tx: TxRow;
  reviewed: boolean;
  emoji: string;
  onOpen: () => void;
  onToggleReviewed: () => void;
}) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; swiping: boolean } | null>(null);
  const moneyIn = tx.amount < 0;
  const THRESHOLD = 72;

  return (
    <li className="relative overflow-hidden group">
      {/* Swipe backgrounds */}
      {dx !== 0 && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 flex items-center px-5 text-[13px] font-semibold text-[#fff] ${
            dx > 0 ? "bg-sys-green justify-start" : "bg-sys-blue justify-end"
          }`}
        >
          {dx > 0 ? (reviewed ? "Unreview" : "Reviewed") : "Edit"}
        </div>
      )}
      <div
        role="button"
        tabIndex={0}
        onClick={() => dx === 0 && onOpen()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
        onTouchStart={(e) => (start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, swiping: false })}
        onTouchMove={(e) => {
          const s = start.current;
          if (!s) return;
          const mx = e.touches[0].clientX - s.x;
          const my = e.touches[0].clientY - s.y;
          if (!s.swiping && Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.5) s.swiping = true;
          if (s.swiping) setDx(Math.max(-120, Math.min(120, mx)));
        }}
        onTouchEnd={() => {
          if (dx >= THRESHOLD) onToggleReviewed();
          else if (dx <= -THRESHOLD) onOpen();
          start.current = null;
          setTimeout(() => setDx(0), 0);
        }}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? "none" : "transform 0.25s cubic-bezier(0.25,0.1,0.25,1)" }}
        className="relative flex items-center gap-3 pl-4 pr-3 py-3 bg-surface hover:bg-white/[0.03] cursor-pointer border-b-[0.5px] border-white/[0.06] focus-visible:outline-offset-[-2px]"
      >
        <span className="relative shrink-0">
          <span className="w-10 h-10 rounded-full bg-white/[0.07] flex items-center justify-center text-[18px]">{emoji}</span>
          {!reviewed && <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-sys-blue" aria-label="Needs review" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[15px] font-medium truncate">{tx.merchantName || tx.name}</span>
            {tx.pending && <span className="shrink-0 text-[11px] font-semibold px-1.5 py-px rounded bg-white/[0.08] text-label-2">Pending</span>}
            {(tx.splits?.length ?? 0) > 0 && <Scissors className="w-3.5 h-3.5 text-label-3 shrink-0" aria-label="Split" />}
          </div>
          <div className="text-[13px] text-label-2 truncate">
            {tx.category}
            {tx.account?.name ? ` · ${tx.account.name}` : ""}
            {(tx.tags?.length ?? 0) > 0 && <span className="text-sys-blue"> · {tx.tags!.join(" ")}</span>}
          </div>
        </div>
        <span className={`text-[15px] font-semibold tabular-nums shrink-0 ${moneyIn ? "text-sys-green" : ""}`}>{signed(tx.amount)}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleReviewed();
          }}
          aria-label={reviewed ? "Mark as needs review" : "Mark as reviewed"}
          aria-pressed={reviewed}
          className={`hidden md:flex w-7 h-7 rounded-full items-center justify-center shrink-0 transition ${
            reviewed ? "text-sys-green opacity-60 hover:opacity-100" : "text-label-3 opacity-0 group-hover:opacity-100 hover:text-sys-green"
          }`}
        >
          <Check className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>
    </li>
  );
}

/** Glass sheet for editing (or adding) a transaction. */
function TransactionSheet({
  mode,
  tx,
  accounts,
  categories,
  emojiMap,
  onClose,
  onSaved,
}: {
  mode: "edit" | "new";
  tx?: TxRow;
  accounts: { id: string; name: string; mask?: string | null }[];
  categories: string[];
  emojiMap: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(tx?.merchantName || tx?.name || "");
  const [moneyIn, setMoneyIn] = useState(tx ? tx.amount < 0 : false);
  const [amount, setAmount] = useState(tx ? String(Math.abs(tx.amount)) : "");
  const [date, setDate] = useState(tx ? calendarISODate(tx.date) : localISODate());
  const [category, setCategory] = useState(tx?.category || "General");
  const [accountId, setAccountId] = useState(tx?.accountId || tx?.account?.id || accounts[0]?.id || "");
  const [reviewed, setReviewed] = useState(tx?.reviewed ?? true);
  const [tags, setTags] = useState<string[]>(tx?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [applyToMerchant, setApplyToMerchant] = useState(false);
  const [splitting, setSplitting] = useState((tx?.splits?.length ?? 0) > 0);
  const [splits, setSplits] = useState<{ category: string; amount: string }[]>(
    tx?.splits?.length
      ? tx.splits.map((s) => ({ category: s.category, amount: String(s.amount) }))
      : [
          { category: tx?.category || "General", amount: "" },
          { category: "Shopping", amount: "" },
        ]
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const total = Math.abs(parseFloat(amount) || 0);
  const splitSum = splits.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
  const splitLeft = Math.round((total - splitSum) * 100) / 100;
  const merchant = tx?.merchantName || tx?.name || "";
  const categoryChanged = mode === "edit" && tx && category !== tx.category;

  const addTag = () => {
    const t = tagInput.trim().replace(/^#?/, "#");
    if (t.length > 1 && !tags.includes(t) && tags.length < 20) setTags([...tags, t.slice(0, 40)]);
    setTagInput("");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !total) return notify("Enter a name and an amount.");
    if (splitting && Math.abs(splitLeft) > 0.01) return notify(`Splits must add up to ${usd(total)} (${usd(Math.abs(splitLeft))} ${splitLeft > 0 ? "left" : "over"}).`);
    setSaving(true);
    const signedAmount = (moneyIn ? -1 : 1) * total;
    const ok =
      mode === "new"
        ? await checkedFetch(
            "/api/transactions",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: name.trim(), amount: signedAmount, category, accountId, date, tags }),
            },
            "Couldn't add that transaction."
          )
        : await checkedFetch(
            "/api/transactions",
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: tx!.id,
                name: name.trim(),
                amount: signedAmount,
                date,
                category,
                reviewed,
                tags,
                splits: splitting ? splits.map((s) => ({ category: s.category, amount: parseFloat(s.amount) || 0 })) : [],
                ...(applyToMerchant && categoryChanged ? { createRule: true, merchantPattern: merchant } : {}),
              }),
            },
            "Couldn't save your changes."
          );
    setSaving(false);
    if (!ok) return;
    if (applyToMerchant && categoryChanged) notify(`All "${merchant}" transactions are now ${category}.`, "success");
    onSaved();
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={mode === "new" ? "Add transaction" : "Edit transaction"}
        className="liquid-glass w-full md:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-[28px] md:rounded-[28px] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] md:pb-5 view-enter"
      >
        <div className="flex items-center justify-between mb-4">
          <button type="button" onClick={onClose} className="text-[17px] text-sys-blue">
            Cancel
          </button>
          <h3 className="text-[17px] font-semibold">{mode === "new" ? "New Transaction" : "Transaction"}</h3>
          <button type="submit" disabled={saving} className="text-[17px] font-semibold text-sys-blue disabled:opacity-40">
            {saving ? "Saving…" : mode === "new" ? "Add" : "Save"}
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex bg-white/[0.08] rounded-[10px] p-0.5 text-[13px] font-semibold" role="radiogroup" aria-label="Type">
            {[
              { v: false, label: "Expense" },
              { v: true, label: "Money in" },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={moneyIn === o.v}
                onClick={() => setMoneyIn(o.v)}
                className={`flex-1 py-1.5 rounded-[8px] transition ${moneyIn === o.v ? (o.v ? "bg-sys-green text-[#fff]" : "bg-surface-3") : "text-label-2"}`}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl bg-surface/70 divide-y divide-white/[0.08]">
            <label className="flex items-center gap-3 px-4 py-3">
              <span className="w-20 text-[15px] text-label-2">Amount</span>
              <input
                inputMode="decimal"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={`flex-1 bg-transparent text-[22px] font-semibold tabular-nums text-right !shadow-none !border-0 ${moneyIn ? "text-sys-green" : ""}`}
                autoFocus={mode === "new"}
              />
            </label>
            <label className="flex items-center gap-3 px-4 py-3">
              <span className="w-20 text-[15px] text-label-2">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} className="flex-1 bg-transparent text-[15px] text-right !shadow-none !border-0" />
            </label>
            <label className="flex items-center gap-3 px-4 py-3">
              <span className="w-20 text-[15px] text-label-2">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1 bg-transparent text-[15px] text-right !shadow-none !border-0" />
            </label>
            {mode === "new" ? (
              <label className="flex items-center gap-3 px-4 py-3">
                <span className="w-20 text-[15px] text-label-2">Account</span>
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="flex-1 bg-transparent text-[15px] text-right !shadow-none !border-0">
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.mask ? ` ••${a.mask}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 text-[15px]">
                <span className="w-20 text-label-2">Account</span>
                <span className="flex-1 text-right text-label-2">{tx?.account?.name}</span>
              </div>
            )}
          </div>

          <div>
            <div className="text-[13px] font-semibold text-label-2 uppercase tracking-[0.03em] mb-2 px-1">Category</div>
            <div className="flex flex-wrap gap-2">
              {[...new Set([category, ...categories])].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  aria-pressed={category === c}
                  className={`rounded-full px-3 py-1.5 text-[14px] transition ${category === c ? "bg-sys-blue text-[#fff]" : "bg-white/[0.08] hover:bg-white/[0.12]"}`}
                >
                  {getCategoryEmoji(c, emojiMap)} {c}
                </button>
              ))}
            </div>
            {categoryChanged && merchant && (
              <label className="mt-3 flex items-center gap-2.5 text-[14px] px-1">
                <input type="checkbox" checked={applyToMerchant} onChange={(e) => setApplyToMerchant(e.target.checked)} className="w-4 h-4 accent-[#0A84FF]" />
                Apply to all &ldquo;{merchant}&rdquo; transactions and future ones
              </label>
            )}
          </div>

          <div>
            <div className="text-[13px] font-semibold text-label-2 uppercase tracking-[0.03em] mb-2 px-1">Tags</div>
            <div className="flex flex-wrap items-center gap-2">
              {tags.map((t) => (
                <span key={t} className="flex items-center gap-1 rounded-full bg-sys-blue/15 text-sys-blue px-2.5 py-1 text-[13px]">
                  {t}
                  <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
              <span className="flex items-center gap-1.5 rounded-full bg-white/[0.08] px-2.5 py-1">
                <Tag className="w-3.5 h-3.5 text-label-2" />
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  onBlur={() => tagInput.trim() && addTag()}
                  placeholder="Add tag"
                  className="w-24 bg-transparent text-[13px] !shadow-none !border-0"
                />
              </span>
            </div>
          </div>

          {mode === "edit" && (
            <>
              <div className="rounded-2xl bg-surface/70">
                <label className="flex items-center justify-between px-4 py-3 text-[15px]">
                  <span className="flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-label-2" /> Split across categories
                  </span>
                  <Switch checked={splitting} onChange={setSplitting} />
                </label>
                {splitting && (
                  <div className="px-4 pb-4 space-y-2">
                    {splits.map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <select
                          value={s.category}
                          onChange={(e) => setSplits(splits.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))}
                          className="select-apple flex-1"
                        >
                          {[...new Set([s.category, ...categories])].map((c) => (
                            <option key={c} value={c}>
                              {getCategoryEmoji(c, emojiMap)} {c}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={s.amount}
                          onChange={(e) => setSplits(splits.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                          placeholder="0.00"
                          className="select-apple w-28 text-right tabular-nums"
                        />
                        <button
                          type="button"
                          onClick={() => setSplits(splits.filter((_, j) => j !== i))}
                          disabled={splits.length <= 2}
                          aria-label="Remove split"
                          className="w-8 h-8 rounded-full flex items-center justify-center text-label-2 hover:text-sys-red disabled:opacity-30"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-[13px] pt-1">
                      <button
                        type="button"
                        onClick={() => splits.length < 10 && setSplits([...splits, { category: "General", amount: splitLeft > 0 ? splitLeft.toFixed(2) : "" }])}
                        className="text-sys-blue font-medium"
                      >
                        + Add split
                      </button>
                      <span className={Math.abs(splitLeft) <= 0.01 ? "text-sys-green" : "text-sys-orange"}>
                        {Math.abs(splitLeft) <= 0.01 ? "Adds up ✓" : `${usd(Math.abs(splitLeft))} ${splitLeft > 0 ? "left to assign" : "over"}`}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <label className="flex items-center justify-between rounded-2xl bg-surface/70 px-4 py-3 text-[15px]">
                Reviewed
                <Switch checked={reviewed} onChange={setReviewed} />
              </label>
            </>
          )}
        </div>
      </form>
    </div>,
    document.body
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-[51px] h-[31px] rounded-full transition-colors shrink-0 ${checked ? "bg-sys-green" : "bg-white/[0.16]"}`}
    >
      <span
        className="absolute top-[2px] left-[2px] w-[27px] h-[27px] rounded-full bg-[#fff] shadow transition-transform duration-200 ease-apple"
        style={{ transform: checked ? "translateX(20px)" : undefined }}
      />
    </button>
  );
}
