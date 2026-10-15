"use client";

import { useState } from "react";
import { Eye, EyeOff, AlertCircle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface CopilotHeaderProps {
  netWorth: number;
  totalAssets: number;
  totalCash: number;
  totalInvestments: number;
  totalCreditDebt: number;
  /** Optional breakdown of totalCreditDebt */
  creditCardDebt?: number;
  loanDebt?: number;
  currentMonthIncome: number;
  currentMonthExpenses: number;
  totalBudgetLimit: number;
  unreviewedCount: number;
  creditInstitutions?: string[];
  selectedMonth?: string;
  onMonthChange?: (month: string) => void;
  history?: {
    date: string;
    NetWorth: number;
    Cash: number;
    Investments: number;
    Debt: number;
  }[];
  onRefresh: () => void;
}

export function CopilotHeader({
  netWorth,
  totalCash,
  totalInvestments,
  totalCreditDebt,
  creditCardDebt,
  loanDebt = 0,
  currentMonthIncome,
  currentMonthExpenses,
  totalBudgetLimit,
  unreviewedCount,
  creditInstitutions,
  history = [],
}: CopilotHeaderProps) {
  const [privacyMode, setPrivacyMode] = useState(false);

  const fmt = (val: number, digits = 0) =>
    privacyMode
      ? "••••"
      : new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }).format(val);

  const start = history.length > 1 ? history[0].NetWorth : netWorth;
  const change = netWorth - start;
  const changePct = start !== 0 ? (change / Math.abs(start)) * 100 : 0;
  const up = change >= 0;
  const lineColor = up ? "#30D158" : "#FF453A";

  const budgetPct = totalBudgetLimit > 0 ? Math.min(Math.round((currentMonthExpenses / totalBudgetLimit) * 100), 100) : 0;
  const net = currentMonthIncome - currentMonthExpenses;

  const [whole, cents] = fmt(netWorth, 2).split(".");

  const tiles = [
    { label: "Income", value: fmt(currentMonthIncome), sub: "This period", color: "#30D158" },
    { label: "Spending", value: fmt(currentMonthExpenses), sub: net >= 0 ? `${fmt(net)} saved` : `${fmt(-net)} over income`, color: "#FF9F0A" },
    { label: "Cash", value: fmt(totalCash), sub: "Checking & savings", color: "#0A84FF" },
    { label: "Investments", value: fmt(totalInvestments), sub: "Brokerage & retirement", color: "#BF5AF2" },
    {
      // Loans are debt too, so the tile only says "Credit Cards" when there are none
      label: loanDebt > 0 ? "Debt" : "Credit Cards",
      value: fmt(totalCreditDebt),
      sub:
        loanDebt > 0
          ? `Cards ${fmt(creditCardDebt ?? totalCreditDebt - loanDebt)} · Loans ${fmt(loanDebt)}`
          : creditInstitutions && creditInstitutions.length > 0
            ? creditInstitutions.join(", ")
            : "Balance owed",
      color: "#FF453A",
    },
  ];

  return (
    <section className="space-y-4">
      {/* Net worth hero */}
      <div className="card relative overflow-hidden">
        <div className="relative p-5 sm:p-7 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-6 items-end">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-label-2">Net Worth</span>
              <button
                onClick={() => setPrivacyMode(!privacyMode)}
                aria-pressed={privacyMode}
                aria-label={privacyMode ? "Show balances" : "Hide balances"}
                title={privacyMode ? "Show balances" : "Hide balances"}
                className="lg:hidden w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.08] text-label-2 hover:text-white transition"
              >
                {privacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="mt-1 font-display font-bold tracking-[-0.035em] tabular-nums text-white leading-none">
              <span className="text-[44px] sm:text-[56px]">{whole}</span>
              {cents && <span className="text-[26px] sm:text-[32px] text-label-2">.{cents}</span>}
            </div>
            {history.length > 1 && (
              <div className="mt-3 flex items-center gap-2 text-[15px] font-semibold tabular-nums" style={{ color: lineColor }}>
                {up ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                <span>
                  {privacyMode ? "••••" : `${up ? "+" : "−"}${fmt(Math.abs(change))}`} ({Math.abs(changePct).toFixed(1)}%)
                </span>
                <span className="text-label-3 font-medium">since {history[0].date}</span>
              </div>
            )}
            {unreviewedCount > 0 && (
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-sys-orange/15 text-sys-orange px-3 py-1 text-[13px] font-semibold">
                <AlertCircle className="w-3.5 h-3.5" />
                {unreviewedCount} to review
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setPrivacyMode(!privacyMode)}
              aria-pressed={privacyMode}
              aria-label={privacyMode ? "Show balances" : "Hide balances"}
              title={privacyMode ? "Show balances" : "Hide balances"}
              className="hidden lg:flex absolute -top-1 right-0 z-10 w-8 h-8 rounded-full items-center justify-center bg-white/[0.08] text-label-2 hover:text-white transition"
            >
              {privacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <div className="h-28 sm:h-36 lg:mt-6">
              {history.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="heroNw" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" hide />
                    <YAxis hide domain={["dataMin", "dataMax"]} />
                    <Tooltip
                      cursor={{ stroke: "rgba(142,142,147,0.5)", strokeWidth: 1 }}
                      contentStyle={{
                        background: "rgb(var(--c-surface-2) / 0.96)",
                        border: "none",
                        borderRadius: 12,
                        fontSize: 13,
                        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                      }}
                      labelStyle={{ color: "rgb(var(--label-2))" }}
                      formatter={(v: any) => [privacyMode ? "••••" : `$${Number(v).toLocaleString()}`, "Net Worth"]}
                    />
                    <Area type="monotone" dataKey="NetWorth" stroke={lineColor} strokeWidth={2.25} fill="url(#heroNw)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[13px] text-label-3">
                  Your trend will appear after a few days of history.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Budget ring + stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="card col-span-2 lg:col-span-1 lg:row-span-1 p-4 flex lg:flex-col items-center lg:items-start gap-4">
          <BudgetRing pct={budgetPct} />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-label-2">Budget</div>
            <div className="text-[17px] font-semibold tabular-nums">{fmt(Math.max(0, totalBudgetLimit - currentMonthExpenses))}</div>
            <div className="text-[12px] text-label-3">left of {fmt(totalBudgetLimit)}</div>
          </div>
        </div>
        {tiles.map((t, i) => (
          <div key={t.label} className={`card p-4 flex flex-col justify-between gap-3 ${i === tiles.length - 1 ? "col-span-2 lg:col-span-1" : ""}`}>
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-label-2">
              <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
              {t.label}
            </div>
            <div>
              <div className="text-[22px] font-display font-semibold tracking-[-0.02em] tabular-nums leading-tight">{t.value}</div>
              <div className="text-[12px] text-label-3 truncate">{t.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BudgetRing({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const color = pct >= 90 ? "#FF453A" : pct >= 75 ? "#FF9F0A" : "#30D158";
  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" style={{ stroke: "rgb(var(--c-fg) / 0.1)" }} strokeWidth="7" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.25,0.1,0.25,1)" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold tabular-nums">{pct}%</span>
    </div>
  );
}
