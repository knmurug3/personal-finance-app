"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { BarChart3, PieChart as PieIcon, ArrowUpRight, ArrowDownRight, Layers, TrendingUp, AlertCircle } from "lucide-react";
import { getCategoryEmoji } from "@/lib/categoryEmoji";

interface CashFlowChartProps {
  currentMonthIncome: number;
  currentMonthExpenses: number;
  categorySpending: Record<string, number>;
  onCategoryClick?: (category: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  Housing: "#0A84FF",
  "Food & Dining": "#30D158",
  Grocery: "#30D158",
  Transport: "#FF9F0A",
  Shopping: "#FF375F",
  Entertainment: "#BF5AF2",
  Utilities: "#64D2FF",
  Insurance: "#5E5CE6",
  Healthcare: "#FF453A",
  "Health & Fitness": "#0A84FF",
  Personal: "#0A84FF",
  "Personal Care": "#FF375F",
  Travel: "#64D2FF",
  General: "#8E8E93",
};

export function CashFlowChart({
  currentMonthIncome,
  currentMonthExpenses,
  categorySpending = {},
  onCategoryClick,
}: CashFlowChartProps) {
  const [activeTab, setActiveTab] = useState<"categories" | "summary">("categories");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  // Spending forecast: project end-of-month total based on daily pace
  const dailyPace = dayOfMonth > 0 ? currentMonthExpenses / dayOfMonth : 0;
  const projectedExpenses = Math.round(dailyPace * daysInMonth * 100) / 100;
  const daysLeft = daysInMonth - dayOfMonth;
  const forecastDiff = projectedExpenses - currentMonthExpenses;

  const totalSpent = Object.values(categorySpending).reduce((a, b) => a + b, 0);

  const categoryData = Object.entries(categorySpending)
    .filter(([, val]) => val > 0)
    .map(([cat, val]) => ({
      name: cat,
      displayName: `${getCategoryEmoji(cat)} ${cat}`,
      value: Math.round(val * 100) / 100,
      pct: totalSpent > 0 ? Math.round((val / totalSpent) * 100) : 0,
      color: CATEGORY_COLORS[cat] || "#0A84FF",
    }))
    .sort((a, b) => b.value - a.value);

  // Summary tab includes forecast bar
  const summaryData = [
    { name: "Income", amount: currentMonthIncome, fill: "#30D158" },
    { name: "Spent So Far", amount: currentMonthExpenses, fill: "#FF453A" },
    { name: "Projected Total", amount: projectedExpenses, fill: "#FF9F0A", isProjected: true },
  ];

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);

  const savingsLeftIfOnPace = currentMonthIncome - projectedExpenses;
  const onTrack = projectedExpenses <= currentMonthIncome;

  return (
    <div className="bg-surface border border-white/[0.08] rounded-[22px] p-4 sm:p-6 shadow-card backdrop-blur-xl flex flex-col justify-between">
      {/* Header & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-[20px] font-semibold tracking-tight text-white flex items-center gap-2">
            Spending
          </h3>
          <p className="text-label-2 text-[13px] mt-0.5">By category this period</p>
        </div>

        <div className="flex bg-white/[0.05] p-1 border border-white/[0.08] rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("categories")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === "categories"
                ? "bg-slate-800 text-teal-400 shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            By Category
          </button>
          <button
            onClick={() => setActiveTab("summary")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === "summary"
                ? "bg-slate-800 text-teal-400 shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Forecast
          </button>
        </div>
      </div>

      {/* Main Chart Content */}
      {activeTab === "categories" ? (
        categoryData.length > 0 ? (
          <div className="space-y-4">
            <div className="h-72 w-full pr-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={categoryData}
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  onClick={(data) => {
                    if (data?.activePayload?.[0]) {
                      const cat = data.activePayload[0].payload.name;
                      setExpandedCategory(expandedCategory === cat ? null : cat);
                      onCategoryClick?.(cat);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(142,142,147,0.22)" horizontal={false} />
                  <XAxis type="number" stroke="#8E8E93" fontSize={11} tickLine={false} tickFormatter={formatCurrency} />
                  <YAxis
                    type="category"
                    dataKey="displayName"
                    stroke="#8E8E93"
                    fontSize={12}
                    fontWeight={600}
                    tickLine={false}
                    width={130}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(142,142,147,0.12)" }}
                    formatter={(val: any, name: any, item: any) => [
                      `${formatCurrency(Number(val))} (${item.payload.pct}%)`,
                      "Spent",
                    ]}
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
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} maxBarSize={24} cursor="pointer">
                    {categoryData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        opacity={expandedCategory && expandedCategory !== entry.name ? 0.4 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-slate-500 text-xs text-center">Tap a bar to highlight a category</p>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
            <Layers className="w-8 h-8 text-slate-700" />
            <span>No category expenses recorded this month</span>
          </div>
        )
      ) : (
        <div className="space-y-4">
          {/* Forecast Banner */}
          <div className={`flex items-start gap-3 p-4 rounded-2xl border ${
            onTrack
              ? "bg-emerald-500/10 border-emerald-500/20"
              : "bg-rose-500/10 border-rose-500/20"
          }`}>
            <TrendingUp className={`w-5 h-5 mt-0.5 shrink-0 ${onTrack ? "text-emerald-400" : "text-rose-400"}`} />
            <div>
              <p className={`text-xs font-bold ${onTrack ? "text-emerald-400" : "text-rose-400"}`}>
                {onTrack ? "✅ On track this month" : "⚠️ Projected to overspend"}
              </p>
              <p className="text-slate-300 text-xs mt-0.5">
                At your current pace of {formatCurrency(dailyPace)}/day, you'll spend{" "}
                <span className="font-bold text-white">{formatCurrency(projectedExpenses)}</span> by end of month.
                {daysLeft > 0 && ` ${daysLeft} days remaining.`}
              </p>
              {currentMonthIncome > 0 && (
                <p className={`text-xs mt-1 font-semibold ${onTrack ? "text-emerald-400" : "text-rose-400"}`}>
                  {onTrack
                    ? `Projected to save ${formatCurrency(savingsLeftIfOnPace)} this month`
                    : `Projected to overspend by ${formatCurrency(Math.abs(savingsLeftIfOnPace))}`}
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1">* Projection based on daily average — large one-off charges (e.g. rent) may inflate early-month forecasts.</p>

          {/* Forecast Bar Chart */}
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summaryData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(142,142,147,0.22)" vertical={false} />
                <XAxis dataKey="name" stroke="#8E8E93" fontSize={11} tickLine={false} />
                <YAxis stroke="#8E8E93" fontSize={11} tickLine={false} tickFormatter={formatCurrency} />
                <Tooltip
                    cursor={{ fill: "rgba(142,142,147,0.12)" }}
                  formatter={(val: any, name: any, item: any) => [
                    formatCurrency(Number(val)),
                    item.payload.isProjected ? "Projected (dotted)" : "Total",
                  ]}
                  itemStyle={{ color: "rgb(var(--c-fg))", fontWeight: 600 }}
                  labelStyle={{ color: "#64D2FF", fontWeight: 700 }}
                  contentStyle={{
                    backgroundColor: "rgb(var(--c-surface))",
                    borderColor: "rgb(var(--c-fg) / 0.12)",
                    borderRadius: "14px",
                    color: "rgb(var(--c-fg))",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]} maxBarSize={55}>
                  {summaryData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.fill}
                      fillOpacity={(entry as any).isProjected ? 0.5 : 1}
                      stroke={(entry as any).isProjected ? entry.fill : "none"}
                      strokeWidth={(entry as any).isProjected ? 2 : 0}
                      strokeDasharray={(entry as any).isProjected ? "6 3" : "0"}
                    />
                  ))}
                </Bar>
                {currentMonthIncome > 0 && (
                  <ReferenceLine
                    y={currentMonthIncome}
                    stroke="#30D158"
                    strokeDasharray="6 3"
                    label={{ value: "Income", fill: "#30D158", fontSize: 11, position: "right" }}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Daily Pace</p>
              <p className="text-sm font-black text-white">{formatCurrency(dailyPace)}</p>
            </div>
            <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Projected</p>
              <p className={`text-sm font-black ${onTrack ? "text-emerald-400" : "text-rose-400"}`}>
                {formatCurrency(projectedExpenses)}
              </p>
            </div>
            <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Days Left</p>
              <p className="text-sm font-black text-white">{daysLeft}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
