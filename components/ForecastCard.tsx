"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { AlertTriangle, ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { Forecast } from "@/lib/forecast";
import { formatCalendarDate } from "@/lib/dates";

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

/** Overview card: projected cash balance with paychecks, bills and a low-balance warning. */
export function ForecastCard({ forecast }: { forecast: Forecast | null }) {
  if (!forecast) {
    return <div className="card p-6 h-[320px] animate-pulse" aria-label="Loading forecast" />;
  }

  const { days, events, lowest, endBalance, threshold, belowThreshold, dailySpend, startBalance } = forecast;
  const horizon = days.length - 1;
  const up = endBalance >= startBalance;
  const upcoming = events.slice(0, 6);
  const lineColor = belowThreshold ? "#FF453A" : "#0A84FF";

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="text-[20px] font-semibold tracking-tight">Cash Forecast</h3>
          <p className="text-[13px] text-label-2">
            Next {horizon} days · paychecks, bills and about {usd(dailySpend)}/day of everyday spending
          </p>
        </div>
        <div className="flex gap-5 text-right">
          <div>
            <div className="text-[12px] text-label-2">Lowest</div>
            <div className={`text-[17px] font-semibold tabular-nums ${belowThreshold ? "text-sys-red" : ""}`}>
              {usd(lowest.balance)}
            </div>
            <div className="text-[12px] text-label-3">{formatCalendarDate(lowest.date, { month: "short", day: "numeric" })}</div>
          </div>
          <div>
            <div className="text-[12px] text-label-2">In {horizon} days</div>
            <div className="text-[17px] font-semibold tabular-nums flex items-center justify-end gap-1">
              {up ? <ArrowUpRight className="w-4 h-4 text-sys-green" /> : <ArrowDownRight className="w-4 h-4 text-sys-red" />}
              {usd(endBalance)}
            </div>
            <div className="text-[12px] text-label-3">from {usd(startBalance)}</div>
          </div>
        </div>
      </div>

      {belowThreshold && (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-sys-red/12 px-3 py-2.5 text-[13px]">
          <AlertTriangle className="w-4 h-4 text-sys-red shrink-0 mt-px" />
          <span>
            Cash is projected to dip to <strong>{usd(lowest.balance)}</strong> on{" "}
            {formatCalendarDate(lowest.date, { month: "short", day: "numeric" })}, below your {usd(threshold)} cushion.
          </span>
        </div>
      )}

      <div className="h-44 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={days} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickFormatter={(d) => formatCalendarDate(d, { month: "short", day: "numeric" })}
              stroke="#8E8E93"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
            />
            <YAxis hide domain={["dataMin - 200", "dataMax + 200"]} />
            <ReferenceLine y={threshold} stroke="rgba(255,69,58,0.5)" strokeDasharray="4 4" />
            <Tooltip
              cursor={{ stroke: "rgba(142,142,147,0.5)", strokeWidth: 1 }}
              contentStyle={{ background: "rgb(var(--c-surface-2) / 0.96)", border: "none", borderRadius: 12, fontSize: 13 }}
              labelStyle={{ color: "rgb(var(--label-2))" }}
              labelFormatter={(d) => formatCalendarDate(String(d), { weekday: "short", month: "short", day: "numeric" })}
              formatter={(v: any) => [usd(Number(v)), "Projected cash"]}
            />
            <Area type="stepAfter" dataKey="balance" stroke={lineColor} strokeWidth={2} fill="url(#forecastFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {upcoming.length > 0 && (
        <ul className="mt-4 divide-y divide-white/[0.08]">
          {upcoming.map((e, i) => (
            <li key={`${e.date}-${e.name}-${i}`} className="flex items-center justify-between gap-3 py-2 text-[14px]">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${e.kind === "paycheck" ? "bg-sys-green" : "bg-sys-orange"}`} />
                <span className="truncate">{e.name}</span>
                <span className="text-label-3 shrink-0">{formatCalendarDate(e.date, { month: "short", day: "numeric" })}</span>
              </div>
              <span className={`tabular-nums font-medium shrink-0 ${e.amount > 0 ? "text-sys-green" : ""}`}>
                {e.amount > 0 ? "+" : "−"}
                {usd(Math.abs(e.amount))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
