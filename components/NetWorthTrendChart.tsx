"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, ShieldCheck, DollarSign } from "lucide-react";

interface NetWorthTrendProps {
  currentNetWorth: number;
  history?: {
    date: string;
    NetWorth: number;
    Cash: number;
    Investments: number;
    Debt: number;
  }[];
}

export function NetWorthTrendChart({
  currentNetWorth,
  history = [],
}: NetWorthTrendProps) {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);

  const firstNetWorth = history.length > 0 ? history[0].NetWorth : currentNetWorth;
  const growth = currentNetWorth - firstNetWorth;
  const growthPct = firstNetWorth !== 0 ? Math.round((growth / Math.abs(firstNetWorth)) * 100) : 0;
  const displayGrowthPct = Math.min(Math.max(growthPct, -9999), 9999);

  return (
    <div className="bg-surface border border-white/[0.08] rounded-[22px] p-6 shadow-card backdrop-blur-xl flex flex-col justify-between">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-[20px] font-semibold tracking-tight text-white flex items-center gap-2">
            Net Worth
          </h3>
          <p className="text-label-2 text-[13px] mt-0.5">Last 30 days</p>
        </div>

        <div className="bg-white/[0.05] p-2 px-3 border border-white/[0.08] rounded-xl flex items-center gap-3">
          <div>
            <div className="text-[10px] text-slate-500 font-bold uppercase">Period Growth</div>
            <div
              className={`text-xs font-black ${
                growth >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {growth >= 0 ? "+" : ""}
              {formatCurrency(growth)} ({displayGrowthPct}%)
            </div>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 w-full">
        {history.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#30D158" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#30D158" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(142,142,147,0.22)" vertical={false} />
              <XAxis dataKey="date" stroke="#8E8E93" fontSize={11} tickLine={false} />
              <YAxis stroke="#8E8E93" fontSize={11} tickLine={false} tickFormatter={formatCurrency} />
              <Tooltip
                    cursor={{ fill: "rgba(142,142,147,0.12)" }}
                formatter={(val: any, name: string) => [formatCurrency(Number(val)), name]}
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
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
              <Area
                type="monotone"
                dataKey="NetWorth"
                name="Net Worth"
                stroke="#30D158"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#netWorthGrad)"
              />
              <Area
                type="monotone"
                dataKey="Investments"
                name="Investments"
                stroke="#BF5AF2"
                strokeWidth={1.5}
                fillOpacity={0}
              />
              <Area
                type="monotone"
                dataKey="Cash"
                name="Cash"
                stroke="#64D2FF"
                strokeWidth={1.5}
                fillOpacity={0}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500 text-xs font-semibold">
            Loading net worth growth trend...
          </div>
        )}
      </div>
    </div>
  );
}
