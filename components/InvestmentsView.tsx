"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ArrowUpRight, ArrowDownRight, ChevronDown, AlertTriangle, LineChart as LineChartIcon, EyeOff } from "lucide-react";
import type { Position, Portfolio } from "@/lib/portfolio";
import { PlaidLinkButton } from "./PlaidLinkButton";

export interface InvestmentsData extends Portfolio {
  history: { date: string; value: number }[];
  activity: {
    id: string;
    date: string;
    name: string;
    type: string;
    subtype: string;
    ticker: string | null;
    quantity: number;
    price: number;
    amount: number;
    institution: string;
  }[];
  needsConsent: { bankItemId: string; institution: string }[];
}

const TYPE_COLORS: Record<string, string> = {
  equity: "#0A84FF",
  etf: "#5E5CE6",
  "mutual fund": "#BF5AF2",
  "fixed income": "#64D2FF",
  cash: "#8E8E93",
  cryptocurrency: "#FF9F0A",
  derivative: "#FF375F",
  unitemized: "#636366",
};
const typeColor = (t: string) => TYPE_COLORS[t] || "#30D158";

const usd = (n: number, digits = 2) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
const pct = (n: number) => `${(Math.abs(n) * 100).toFixed(2)}%`;
const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(n < 1 ? 4 : 3).replace(/0+$/, ""));

type SortKey = "value" | "gain" | "name";

interface LiveQuote {
  price: number;
  change: number;
  changePct: number;
}

type LivePosition = Position & { dayChange: number | null; dayChangePct: number | null; live: boolean };

/** Deterministic sample movement for demo mode when no quotes key is configured. */
function sampleQuote(p: Position): LiveQuote {
  let h = 0;
  for (const c of p.key) h = (h * 31 + c.charCodeAt(0)) % 997;
  const changePct = ((h % 61) - 25) / 1000; // −2.5% … +3.5%
  const price = p.price * (1 + changePct);
  return { price, change: price - p.price, changePct };
}

/**
 * Polls /api/investments/quotes every 60s while the tab is visible.
 * Positions without a quote (cash, mutual funds, missing key) keep Plaid's price.
 */
function useLiveQuotes(positions: Position[], demo: boolean) {
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [status, setStatus] = useState<{ configured: boolean | null; updatedAt: number | null }>({ configured: null, updatedAt: null });

  const symbols = positions
    .filter((p) => p.ticker && p.type !== "cash")
    .map((p) => `${p.ticker}:${p.type}`)
    .join(",");

  const load = useCallback(async () => {
    if (!symbols) return;
    try {
      const res = await fetch(`/api/investments/quotes?symbols=${encodeURIComponent(symbols)}`);
      const body = await res.json();
      if (!res.ok) return;
      if (!body.configured && demo) {
        // Match what the real feed can price: stocks, ETFs and crypto only
        const priceable = positions.filter((p) => p.ticker && ["equity", "etf", "cryptocurrency"].includes(p.type));
        setQuotes(Object.fromEntries(priceable.map((p) => [p.ticker!.toUpperCase(), sampleQuote(p)])));
        setStatus({ configured: false, updatedAt: Date.now() });
        return;
      }
      setQuotes(body.quotes || {});
      setStatus({ configured: Boolean(body.configured), updatedAt: body.configured ? body.fetchedAt : null });
    } catch {
      /* keep last good quotes */
    }
    // positions identity changes every render; symbols captures what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols, demo]);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60_000);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  return { quotes, ...status };
}

export function InvestmentsView({
  data,
  onRefresh,
  demo = false,
}: {
  data: InvestmentsData | null;
  onRefresh: () => void;
  demo?: boolean;
}) {
  const [sort, setSort] = useState<SortKey>("value");
  const [expanded, setExpanded] = useState<string | null>(null);
  const live = useLiveQuotes(data?.positions || [], demo);

  // Overlay live prices: value, return and today's change per position
  const livePositions: LivePosition[] = useMemo(
    () =>
      (data?.positions || []).map((p) => {
        const q = p.ticker ? live.quotes[p.ticker.toUpperCase()] : undefined;
        if (!q) return { ...p, dayChange: null, dayChangePct: null, live: false };
        const value = Math.round(p.quantity * q.price * 100) / 100;
        const gain = p.costBasis === null ? null : value - p.costBasis;
        return {
          ...p,
          price: q.price,
          value,
          gain,
          gainPct: gain === null || !p.costBasis ? null : gain / p.costBasis,
          dayChange: p.quantity * q.change,
          dayChangePct: q.changePct,
          live: true,
        };
      }),
    [data, live.quotes]
  );

  const positions = useMemo(() => {
    const list = [...livePositions];
    if (sort === "gain") list.sort((a, b) => (b.gainPct ?? -Infinity) - (a.gainPct ?? -Infinity));
    else if (sort === "name") list.sort((a, b) => (a.ticker || a.name).localeCompare(b.ticker || b.name));
    return list;
  }, [livePositions, sort]);

  if (!data) {
    return <div className="card p-10 text-center text-[15px] text-label-2">Loading investments…</div>;
  }

  const consentBanner = data.needsConsent.length > 0 && (
    <div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
      <span className="w-10 h-10 rounded-full bg-sys-blue/15 flex items-center justify-center shrink-0">
        <LineChartIcon className="w-5 h-5 text-sys-blue" />
      </span>
      <div className="flex-1">
        <div className="text-[15px] font-semibold">Share holdings from {data.needsConsent.map((c) => c.institution).join(" and ")}</div>
        <div className="text-[13px] text-label-2">
          These accounts are connected for balances only. Allow investments access to see each stock.
        </div>
      </div>
      <div className="flex gap-2">
        {data.needsConsent.map((c) => (
          <PlaidLinkButton
            key={c.bankItemId}
            bankItemId={c.bankItemId}
            addInvestments
            variant="tinted"
            label={data.needsConsent.length > 1 ? `Enable ${c.institution}` : "Enable"}
            onSuccessSync={onRefresh}
          />
        ))}
      </div>
    </div>
  );

  // Accounts with a balance but no holdings detail, grouped by connection for the account picker
  const unitemizedByItem = new Map<string, { institution: string; accounts: typeof data.unitemized }>();
  for (const a of data.unitemized || []) {
    const key = a.bankItemId || a.institution;
    const g = unitemizedByItem.get(key) || { institution: a.institution, accounts: [] };
    g.accounts.push(a);
    unitemizedByItem.set(key, g);
  }
  const unitemizedTotal = (data.unitemized || []).reduce((s, a) => s + a.value, 0);

  const unitemizedCard = unitemizedByItem.size > 0 && (
    <section className="card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-full bg-white/[0.07] flex items-center justify-center shrink-0">
          <EyeOff className="w-5 h-5 text-label-2" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-[17px] font-semibold">Holdings not shared</h3>
          <p className="text-[13px] text-label-2">
            These accounts share only a balance, so their stocks aren&apos;t listed. They&apos;re counted in your total at that
            balance. To see each stock, choose the accounts again and tick them for investments.
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-4">
        {[...unitemizedByItem.entries()].map(([key, g]) => (
          <div key={key} className="rounded-2xl bg-white/[0.05] p-3.5">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-[15px] font-semibold">{g.institution}</span>
              {g.accounts[0].bankItemId && (
                <PlaidLinkButton
                  bankItemId={g.accounts[0].bankItemId}
                  selectAccounts
                  addInvestments
                  variant="tinted"
                  label="Choose Accounts"
                  onSuccessSync={onRefresh}
                />
              )}
            </div>
            {g.accounts.some((a) => a.pending) && (
              <p className="mb-2.5 flex items-center gap-2 text-[13px] text-sys-blue">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-sys-blue/30 border-t-sys-blue animate-spin shrink-0" />
                {g.institution} is preparing your holdings. They&apos;ll appear here automatically, usually within a few
                minutes.
              </p>
            )}
            <ul className="space-y-1.5">
              {g.accounts.map((a) => (
                <li key={a.account} className="flex items-center justify-between gap-3 text-[14px]">
                  <span className="truncate text-label-2">{a.account}</span>
                  <span className="tabular-nums shrink-0">{usd(a.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );

  if (data.positions.length === 0 && unitemizedByItem.size === 0) {
    return (
      <div className="space-y-6">
        {consentBanner}
        <div className="card p-12 text-center">
          <span className="w-14 h-14 rounded-full bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
            <LineChartIcon className="w-7 h-7 text-label-2" />
          </span>
          <h4 className="text-[20px] font-semibold">No Holdings Yet</h4>
          <p className="text-[15px] text-label-2 mt-1 max-w-sm mx-auto mb-6">
            Connect your brokerage accounts to see every stock you own, combined across brokerages.
          </p>
          <div className="inline-block">
            <PlaidLinkButton onSuccessSync={onRefresh} label="Connect Brokerage" />
          </div>
        </div>
      </div>
    );
  }

  // Totals with live prices applied (positions without a quote keep Plaid's value)
  const liveDelta = livePositions.reduce((s, p, i) => s + (p.value - data.positions[i].value), 0);
  const liveGainDelta = livePositions.reduce(
    (s, p, i) => s + (p.costBasis !== null ? p.value - data.positions[i].value : 0),
    0
  );
  const totalValue = data.totalValue + liveDelta;
  const totalGain = data.totalGain + liveGainDelta;
  const totalGainPct = data.totalCost > 0 ? totalGain / data.totalCost : 0;
  const dayChange = livePositions.reduce((s, p) => s + (p.dayChange ?? 0), 0);
  const anyLive = livePositions.some((p) => p.live);
  const dayPct = totalValue - dayChange > 0 ? dayChange / (totalValue - dayChange) : 0;

  const up = totalGain >= 0;
  const hist = data.history;
  const periodChange = hist.length > 1 ? totalValue - hist[0].value : null;
  const lineColor = (periodChange ?? data.totalGain) >= 0 ? "#30D158" : "#FF453A";
  const [whole, cents] = usd(totalValue).split(".");

  return (
    <div className="space-y-6 md:space-y-8">
      {consentBanner}

      {/* Portfolio hero */}
      <div className="card p-5 sm:p-7 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-6 items-end">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[15px] font-semibold text-label-2">Portfolio Value</span>
            {anyLive && live.updatedAt && (
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-label-2" aria-live="polite">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inset-0 rounded-full bg-sys-green animate-ping opacity-60" />
                  <span className="relative w-2 h-2 rounded-full bg-sys-green" />
                </span>
                {live.configured ? "Live" : "Sample prices"} ·{" "}
                {new Date(live.updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </span>
            )}
          </div>
          <div className="mt-1 font-display font-bold tracking-[-0.035em] tabular-nums leading-none">
            <span className="text-[44px] sm:text-[56px]">{whole}</span>
            {cents && <span className="text-[26px] sm:text-[32px] text-label-2">.{cents}</span>}
          </div>
          <div className="mt-3 space-y-1 text-[15px] font-semibold tabular-nums">
            {anyLive && (
              <div className={`flex items-center gap-2 ${dayChange >= 0 ? "text-sys-green" : "text-sys-red"}`}>
                {dayChange >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                <span>
                  {dayChange >= 0 ? "+" : "−"}
                  {usd(Math.abs(dayChange))} ({pct(dayPct)})
                </span>
                <span className="text-label-3 font-medium">today</span>
              </div>
            )}
            {data.totalCost > 0 && (
              <div className={`flex items-center gap-2 ${up ? "text-sys-green" : "text-sys-red"}`}>
                {up ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                <span>
                  {up ? "+" : "−"}
                  {usd(Math.abs(totalGain))} ({pct(totalGainPct)})
                </span>
                <span className="text-label-3 font-medium">total return</span>
              </div>
            )}
            {live.configured === false && !demo && (
              <div className="text-[13px] font-medium text-label-3">
                Prices update once a day. Add a Finnhub key for live prices.
              </div>
            )}
            {unitemizedTotal > 0 && (
              <div className="text-[13px] font-medium text-label-3">
                Includes {usd(unitemizedTotal, 0)} in accounts without holdings detail
              </div>
            )}
            {periodChange !== null && (
              <div className="flex items-center gap-2" style={{ color: lineColor }}>
                {periodChange >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                <span>
                  {periodChange >= 0 ? "+" : "−"}
                  {usd(Math.abs(periodChange))}
                </span>
                <span className="text-label-3 font-medium">since {hist[0].date}</span>
              </div>
            )}
          </div>
        </div>
        <div className="h-28 sm:h-36">
          {hist.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hist} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <Tooltip
                  cursor={{ stroke: "rgba(142,142,147,0.5)", strokeWidth: 1 }}
                  contentStyle={{ background: "rgb(var(--c-surface-2) / 0.96)", border: "none", borderRadius: 12, fontSize: 13 }}
                  labelStyle={{ color: "rgb(var(--label-2))" }}
                  formatter={(v: any) => [usd(Number(v)), "Value"]}
                />
                <Area type="monotone" dataKey="value" stroke={lineColor} strokeWidth={2.25} fill="url(#portfolioFill)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-[13px] text-label-3">
              Your performance chart builds as daily values are recorded.
            </div>
          )}
        </div>
      </div>

      {/* Allocation + brokerages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        <div className="card p-5">
          <h3 className="text-[17px] font-semibold mb-3">Allocation</h3>
          <div className="flex items-center gap-5">
            <div className="w-32 h-32 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.allocation} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="100%" paddingAngle={2} stroke="none">
                    {data.allocation.map((a) => (
                      <Cell key={a.type} fill={typeColor(a.type)} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 space-y-2 min-w-0">
              {data.allocation.map((a) => (
                <li key={a.type} className="flex items-center gap-2 text-[14px]">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: typeColor(a.type) }} />
                  <span className="flex-1 truncate">{a.label}</span>
                  <span className="tabular-nums text-label-2">{(a.weight * 100).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </div>
          {data.concentrated.length > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-sys-orange/12 px-3 py-2.5 text-[13px]">
              <AlertTriangle className="w-4 h-4 text-sys-orange shrink-0 mt-px" />
              <span>
                {data.concentrated.map((c) => `${c.ticker || c.name} (${(c.weight * 100).toFixed(0)}%)`).join(", ")}{" "}
                {data.concentrated.length === 1 ? "is" : "are"} over 20% of your portfolio.
              </span>
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="text-[17px] font-semibold mb-3">By Brokerage</h3>
          <ul className="space-y-3.5">
            {data.institutions.map((inst) => {
              const w = data.totalValue > 0 ? inst.value / data.totalValue : 0;
              return (
                <li key={inst.institution}>
                  <div className="flex items-baseline justify-between text-[14px]">
                    <span className="font-medium">{inst.institution}</span>
                    <span className="tabular-nums">
                      {usd(inst.value, 0)} <span className="text-label-2">· {(w * 100).toFixed(0)}%</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-sys-blue" style={{ width: `${w * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {unitemizedCard}

      {/* Holdings */}
      {positions.length > 0 && (
      <section>
        <div className="flex items-end justify-between mb-2 px-1 gap-3">
          <h3 className="text-[20px] font-semibold tracking-tight">Holdings</h3>
          <div className="flex bg-white/[0.08] rounded-[9px] p-0.5 text-[13px] font-medium" role="tablist" aria-label="Sort holdings">
            {(["value", "gain", "name"] as SortKey[]).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={sort === k}
                onClick={() => setSort(k)}
                className={`px-3 py-1 rounded-[7px] capitalize transition ${sort === k ? "bg-surface-3 shadow-sm" : "text-label-2"}`}
              >
                {k === "gain" ? "Return" : k}
              </button>
            ))}
          </div>
        </div>
        <div className="card overflow-hidden">
          <ul>
            {positions.map((p, i) => (
              <HoldingRow
                key={p.key}
                position={p}
                last={i === positions.length - 1}
                open={expanded === p.key}
                onToggle={() => setExpanded(expanded === p.key ? null : p.key)}
              />
            ))}
          </ul>
        </div>
      </section>
      )}

      {/* Activity */}
      {data.activity.length > 0 && (
        <section>
          <h3 className="text-[20px] font-semibold tracking-tight mb-2 px-1">Activity</h3>
          <div className="card overflow-hidden">
            <ul>
              {data.activity.map((t, i) => {
                // Plaid: positive amount = cash out (buy), negative = cash in (sell, dividend)
                const cashIn = t.amount < 0;
                return (
                  <li key={t.id} className="flex items-center gap-3 pl-4">
                    <span className="w-10 h-10 rounded-full bg-white/[0.07] flex items-center justify-center text-[11px] font-bold shrink-0">
                      {t.ticker ? t.ticker.slice(0, 4) : "$"}
                    </span>
                    <div
                      className={`flex-1 min-w-0 flex items-center justify-between gap-3 py-3 pr-4 ${
                        i < data.activity.length - 1 ? "border-b-[0.5px] border-white/[0.1]" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-[15px] font-medium truncate capitalize">
                          {t.subtype === t.type ? t.type : t.subtype.replace(/_/g, " ")}
                          {t.ticker ? ` · ${t.ticker}` : ""}
                        </div>
                        <div className="text-[13px] text-label-2 truncate">
                          {new Date(t.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ·{" "}
                          {t.institution}
                          {t.type === "buy" || t.type === "sell" ? ` · ${qty(Math.abs(t.quantity))} @ ${usd(t.price)}` : ""}
                        </div>
                      </div>
                      <span className={`text-[15px] font-semibold tabular-nums shrink-0 ${cashIn ? "text-sys-green" : ""}`}>
                        {cashIn ? "+" : "−"}
                        {usd(Math.abs(t.amount))}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

function HoldingRow({ position: p, last, open, onToggle }: { position: LivePosition; last: boolean; open: boolean; onToggle: () => void }) {
  const gainUp = (p.gain ?? 0) >= 0;
  const avgCost = p.costBasis !== null && p.quantity > 0 ? p.costBasis / p.quantity : null;
  return (
    <li className={!last ? "border-b-[0.5px] border-white/[0.1]" : ""}>
      <button onClick={onToggle} aria-expanded={open} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors">
        <span
          className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold text-[#fff] shrink-0"
          style={{ background: typeColor(p.type) }}
        >
          {p.ticker ? p.ticker.slice(0, 4) : "$"}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold truncate">{p.ticker || p.name}</div>
          <div className="text-[13px] text-label-2 truncate">
            {p.type === "cash" ? "Cash & money market" : `${qty(p.quantity)} ${p.type === "cryptocurrency" ? "units" : "shares"} · ${p.name}`}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[15px] font-semibold tabular-nums">{usd(p.value)}</div>
          {p.dayChangePct !== null ? (
            <span
              className={`inline-block mt-0.5 min-w-[64px] text-center rounded-md px-1.5 py-[1px] text-[12px] font-semibold tabular-nums text-[#fff] ${
                p.dayChangePct >= 0 ? "bg-sys-green" : "bg-sys-red"
              }`}
              title="Today's change"
            >
              {p.dayChangePct >= 0 ? "+" : "−"}
              {pct(p.dayChangePct)}
            </span>
          ) : p.gain !== null && p.gainPct !== null ? (
            <div className={`text-[13px] font-medium tabular-nums ${gainUp ? "text-sys-green" : "text-sys-red"}`}>
              {gainUp ? "+" : "−"}
              {pct(p.gainPct)}
            </div>
          ) : (
            <div className="text-[13px] text-label-3">{(p.weight * 100).toFixed(1)}%</div>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-label-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 view-enter">
          <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3 rounded-2xl bg-white/[0.05] p-3.5 text-[13px]">
            <Stat label={p.live ? "Price · live" : "Price"} value={usd(p.price)} />
            <Stat
              label="Today"
              value={p.dayChange !== null ? `${p.dayChange >= 0 ? "+" : "−"}${usd(Math.abs(p.dayChange))}` : "—"}
              tone={p.dayChange === null ? undefined : p.dayChange >= 0 ? "up" : "down"}
            />
            <Stat label="Avg cost" value={avgCost !== null ? usd(avgCost) : "—"} />
            <Stat
              label="Total return"
              value={p.gain !== null ? `${p.gain >= 0 ? "+" : "−"}${usd(Math.abs(p.gain))}` : "—"}
              tone={p.gain === null ? undefined : p.gain >= 0 ? "up" : "down"}
            />
            <Stat label="Portfolio" value={`${(p.weight * 100).toFixed(1)}%`} />
          </dl>
          <ul className="mt-3 space-y-2">
            {p.accounts.map((a) => (
              <li key={a.account} className="flex items-center justify-between gap-3 text-[13px]">
                <div className="min-w-0">
                  <span className="font-medium">{a.institution}</span>
                  <span className="text-label-2"> · {a.account}</span>
                </div>
                <span className="tabular-nums shrink-0">
                  {p.type !== "cash" && <span className="text-label-2">{qty(a.quantity)} · </span>}
                  {usd(a.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div>
      <dt className="text-label-2">{label}</dt>
      <dd className={`font-semibold tabular-nums ${tone === "up" ? "text-sys-green" : tone === "down" ? "text-sys-red" : ""}`}>{value}</dd>
    </div>
  );
}
