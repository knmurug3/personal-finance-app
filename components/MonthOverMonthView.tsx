"use client";

import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Receipt,
  PiggyBank,
  BarChart3,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts";
import { getCategoryEmoji } from "@/lib/categoryEmoji";

interface MoMBucket {
  key: string;
  label: string;
  year: number;
  month: number;
  income: number;
  spending: number;
  netSavings: number;
  savingsRate: number;
  categories: Record<string, number>;
}

interface CategoryMoMItem {
  category: string;
  currentSpent: number;
  prevSpent: number;
  diff: number;
  pct: number;
}

interface MonthOverMonthViewProps {
  data: {
    monthlySummary?: MoMBucket[];
    currentIncome?: number;
    prevIncome?: number;
    incomeMoM?: number;
    currentSpending?: number;
    prevSpending?: number;
    spendingMoM?: number;
    currentSavings?: number;
    prevSavings?: number;
    savingsMoM?: number;
    categoryMoM?: CategoryMoMItem[];
  } | null;
}

export function MonthOverMonthView({ data }: MonthOverMonthViewProps) {
  const [rangeMonths, setRangeMonths] = useState<6 | 3>(6);

  if (!data || !data.monthlySummary) {
    return (
      <div className="bg-surface border border-white/[0.08] rounded-[22px] p-8 flex items-center justify-center text-slate-500 text-xs font-semibold">
        Loading Month-over-Month Intelligence...
      </div>
    );
  }

  const {
    monthlySummary = [],
    currentIncome = 0,
    prevIncome = 0,
    incomeMoM = 0,
    currentSpending = 0,
    prevSpending = 0,
    spendingMoM = 0,
    currentSavings = 0,
    prevSavings = 0,
    savingsMoM = 0,
    categoryMoM = [],
  } = data;

  const chartData = rangeMonths === 3 ? monthlySummary.slice(-3) : monthlySummary;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);

  return (
    <div className="space-y-8">
      {/* Top Header Card */}
      <div className="bg-surface border border-white/[0.08] rounded-[22px] p-6 sm:p-8 shadow-card relative overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl opacity-60 pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
          <div>
            <span className="inline-flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-xs font-bold mb-2">
              <BarChart3 className="w-3.5 h-3.5" />
              Month-over-Month Radar
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Income & Spending MoM View
            </h2>
            <p className="text-label-2 text-[13px] mt-0.5">
              Compare cash flow trends, spending velocity, and savings rates month-over-month
            </p>
          </div>

          {/* Timeline Selector */}
          <div className="flex bg-white/[0.05] p-1 border border-white/[0.08] rounded-2xl self-start sm:self-auto">
            <button
              onClick={() => setRangeMonths(6)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                rangeMonths === 6
                  ? "bg-slate-800 text-teal-400 shadow-md border border-white/[0.16]"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              6 Months
            </button>
            <button
              onClick={() => setRangeMonths(3)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                rangeMonths === 3
                  ? "bg-slate-800 text-teal-400 shadow-md border border-white/[0.16]"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              3 Months
            </button>
          </div>
        </div>

        {/* 3 KPI Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {/* Income MoM Card */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                Monthly Income
              </span>
              <span
                className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                  incomeMoM >= 0
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                }`}
              >
                {incomeMoM >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {incomeMoM >= 0 ? `+${incomeMoM}%` : `${incomeMoM}%`} MoM
              </span>
            </div>

            <div className="text-3xl font-black text-white my-2 tracking-tight">
              {formatCurrency(currentIncome)}
            </div>

            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Prev Month: <strong className="text-slate-200">{formatCurrency(prevIncome)}</strong></span>
            </div>
          </div>

          {/* Spending MoM Card */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                Monthly Spending
              </span>
              <span
                className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                  spendingMoM <= 0
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                }`}
              >
                {spendingMoM <= 0 ? <ArrowDownRight className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                {spendingMoM >= 0 ? `+${spendingMoM}%` : `${spendingMoM}%`} MoM
              </span>
            </div>

            <div className="text-3xl font-black text-rose-400 my-2 tracking-tight">
              {formatCurrency(currentSpending)}
            </div>

            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Prev Month: <strong className="text-slate-200">{formatCurrency(prevSpending)}</strong></span>
            </div>
          </div>

          {/* Net Cash Savings Card */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                Net Cash Flow
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-full">
                <PiggyBank className="w-3.5 h-3.5" />
                Net Savings
              </span>
            </div>

            <div
              className={`text-3xl font-black my-2 tracking-tight ${
                currentSavings >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {currentSavings >= 0 ? "+" : ""}{formatCurrency(currentSavings)}
            </div>

            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Prev Savings: <strong className="text-slate-200">{formatCurrency(prevSavings)}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Main MoM Income vs Spending Chart */}
      <div className="bg-surface border border-white/[0.08] rounded-[22px] p-6 sm:p-8 shadow-card backdrop-blur-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-[17px] font-semibold tracking-tight text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-teal-400" />
              Month-over-Month Income vs. Spending Comparison
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">
              Side-by-side breakdown of monthly earnings vs outgoing expenses
            </p>
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(142,142,147,0.22)" vertical={false} />
              <XAxis dataKey="label" stroke="#8E8E93" fontSize={11} tickLine={false} />
              <YAxis stroke="#8E8E93" fontSize={11} tickLine={false} tickFormatter={formatCurrency} />
              <Tooltip
                    cursor={{ fill: "rgba(142,142,147,0.12)" }}
                formatter={(val: any, name: any) => [formatCurrency(Number(val)), name]}
                itemStyle={{ color: "rgb(var(--c-fg))", fontWeight: 600 }}
                labelStyle={{ color: "#64D2FF", fontWeight: 700 }}
                contentStyle={{
                  backgroundColor: "rgb(var(--c-surface))",
                  borderColor: "rgb(var(--c-fg) / 0.12)",
                  borderRadius: "14px",
                  color: "rgb(var(--c-fg))",
                  fontSize: "12px",
                  boxShadow: "0 20px 25px -5px rgba(0,0,0,0.8)",
                }}
              />
              <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }} />
              <Bar dataKey="income" name="Income (💵)" fill="#30D158" radius={[6, 6, 0, 0]} maxBarSize={45} />
              <Bar dataKey="spending" name="Spending (🛍️)" fill="#FF453A" radius={[6, 6, 0, 0]} maxBarSize={45} />
              <Line
                type="monotone"
                dataKey="netSavings"
                name="Net Cash Flow"
                stroke="#FF9F0A"
                strokeWidth={3}
                dot={{ fill: "#FF9F0A", r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Breakdown MoM Comparison Table */}
      <div className="bg-surface border border-white/[0.08] rounded-[22px] p-6 sm:p-8 shadow-card backdrop-blur-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-[17px] font-semibold tracking-tight text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              Category-by-Category MoM Shift Matrix
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">
              Track exactly where your spending increased or decreased compared to last month
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] text-slate-400 font-bold uppercase tracking-wider">
                <th className="pb-3 px-3">Category</th>
                <th className="pb-3 px-3 text-right">This Month</th>
                <th className="pb-3 px-3 text-right">Prev Month</th>
                <th className="pb-3 px-3 text-right">Difference ($)</th>
                <th className="pb-3 px-3 text-right">Shift (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {categoryMoM.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 text-sm">
                    No category data yet — add transactions to see month-over-month trends.
                  </td>
                </tr>
              )}
              {categoryMoM.map((item) => {
                const isIncreased = item.diff > 0;
                const isDecreased = item.diff < 0;

                return (
                  <tr key={item.category} className="hover:bg-white/[0.05] transition">
                    <td className="py-3 px-3 font-bold text-slate-200 flex items-center gap-2">
                      <span>{getCategoryEmoji(item.category)}</span>
                      <span>{item.category}</span>
                    </td>

                    <td className="py-3 px-3 text-right font-black text-slate-100">
                      {formatCurrency(item.currentSpent)}
                    </td>

                    <td className="py-3 px-3 text-right text-slate-400 font-semibold">
                      {formatCurrency(item.prevSpent)}
                    </td>

                    <td
                      className={`py-3 px-3 text-right font-bold ${
                        isIncreased
                          ? "text-rose-400"
                          : isDecreased
                          ? "text-emerald-400"
                          : "text-slate-400"
                      }`}
                    >
                      {isIncreased ? "+" : ""}
                      {formatCurrency(item.diff)}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <span
                        className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                          isIncreased
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : isDecreased
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {isIncreased ? "▲ +" : isDecreased ? "▼ " : ""}
                        {item.pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
