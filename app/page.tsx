"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  DEMO_DASHBOARD,
  DEMO_TRANSACTIONS,
  DEMO_SUBSCRIPTIONS,
  DEMO_NETWORTH_HISTORY,
  DEMO_INSIGHTS,
  DEMO_INVESTMENTS,
} from "@/lib/demoData";

import { CopilotHeader } from "@/components/CopilotHeader";
import { TransactionsView } from "@/components/TransactionsView";
import { CopilotBudgets } from "@/components/CopilotBudgets";
import { AccountsList } from "@/components/AccountsList";
import { CashFlowChart } from "@/components/CashFlowChart";
import { SubscriptionsTracker } from "@/components/SubscriptionsTracker";
import { UpcomingBillsTimeline } from "@/components/UpcomingBillsTimeline";
import { NetWorthTrendChart } from "@/components/NetWorthTrendChart";
import { MonthOverMonthView } from "@/components/MonthOverMonthView";
import { PlaidLinkButton } from "@/components/PlaidLinkButton";
import { LoginScreen } from "@/components/LoginScreen";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import GoalsTracker from "@/components/GoalsTracker";
import ManualAccountsManager from "@/components/ManualAccountsManager";
import RulesManager from "@/components/RulesManager";
import QuickAddTransaction from "@/components/QuickAddTransaction";
import { RecentTransactions } from "@/components/RecentTransactions";
import { InvestmentsView, type InvestmentsData } from "@/components/InvestmentsView";
import { AskView } from "@/components/AskView";
import { ForecastCard } from "@/components/ForecastCard";
import { HealthCard } from "@/components/HealthCard";
import { ErrorReporter } from "@/components/ErrorReporter";
import { buildForecast, type Forecast } from "@/lib/forecast";
import { localISODate } from "@/lib/dates";
import { CardRewardsMaximizer } from "@/components/CardRewardsMaximizer";
import { analyzeCreditCardRewards } from "@/lib/rewards";


import { NAV_SECTIONS, navItem } from "@/components/navigation";
import { LogoMark } from "@/components/Logo";
import { RefreshCw, Lock, Sparkles, ChevronDown, X, AlertCircle, CheckCircle2, MessageCircle, ArrowUp } from "lucide-react";
import { NotificationsButton } from "@/components/NotificationsButton";
import { PasskeySetup } from "@/components/PasskeySetup";
import { SignOutEverywhere } from "@/components/SignOutEverywhere";
import { ConfirmHost } from "@/components/ConfirmHost";

function monthOptions() {
  const now = new Date();
  const opts: { value: string; label: string }[] = [{ value: "current", label: "This Month" }];
  for (let i = 1; i <= 5; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    });
  }
  opts.push({ value: "ytd", label: "Year to Date" });
  return opts;
}

export type TabType =
  | "dashboard"
  | "transactions"
  | "investments"
  | "ask"
  | "budgets"
  | "goals"
  | "mom"
  | "subscriptions"
  | "accounts"
  | "manual"
  | "rules";

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-white/[0.06] animate-pulse rounded-[22px] ${className}`} />;
}

function TabSkeleton({ tab }: { tab: TabType }) {
  if (tab === "dashboard")
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  if (tab === "transactions")
    return (
      <div className="space-y-3">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  if (tab === "budgets" || tab === "goals" || tab === "rules" || tab === "manual")
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  if (tab === "mom" || tab === "investments")
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  if (tab === "subscriptions" || tab === "accounts")
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  return null;
}

/** Loads every transaction (paged), so search, filters and CSV export see the full history. */
async function fetchAllTransactions(): Promise<any | null> {
  const PAGE_SIZE = 1000;
  let first: any = null;
  const all: any[] = [];
  for (let page = 0; page < 50; page++) {
    const res = await fetch(`/api/transactions?page=${page}&pageSize=${PAGE_SIZE}`);
    if (!res.ok) return first ? { ...first, transactions: all } : null;
    const data = await res.json();
    first ??= data;
    all.push(...(data.transactions || []));
    if (!data.transactions || data.transactions.length < PAGE_SIZE || all.length >= data.total) break;
  }
  return first ? { ...first, transactions: all } : null;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  // Dates depend on the viewer's time zone, so compute them after hydration (the server runs in UTC)
  const [today, setToday] = useState("");
  const [periods, setPeriods] = useState<{ value: string; label: string }[]>([{ value: "current", label: "This Month" }]);
  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }));
    setPeriods(monthOptions());
  }, []);

  const [askSeed, setAskSeed] = useState<string | null>(null);
  const [overviewQuestion, setOverviewQuestion] = useState("");

  const [toast, setToast] = useState<{ text: string; tone: "error" | "info" | "success" } | null>(null);

  const showToast = useCallback((text: string, tone: "error" | "info" | "success" = "info") => {
    setToast({ text, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.tone === "error" ? 8000 : 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Toasts raised from any component via lib/notify
  useEffect(() => {
    const onToast = (e: Event) => {
      const { text, tone } = (e as CustomEvent).detail || {};
      if (text) showToast(text, tone);
    };
    window.addEventListener("app-toast", onToast);
    return () => window.removeEventListener("app-toast", onToast);
  }, [showToast]);

  // Deep links from notifications, e.g. /?tab=transactions
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab && NAV_SECTIONS.some((s) => s.items.some((i) => i.id === tab))) {
      setActiveTab(tab as TabType);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isDemoUser, setIsDemoUser] = useState<boolean>(false);

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [transactionsData, setTransactionsData] = useState<any>(null);
  const [subscriptionsData, setSubscriptionsData] = useState<any>(null);
  const [netWorthHistoryData, setNetWorthHistoryData] = useState<any>(null);
  const [insightsData, setInsightsData] = useState<any>(null);
  const [goalsData, setGoalsData] = useState<any[]>([]);
  const [manualAccountsData, setManualAccountsData] = useState<any[]>([]);
  const [rulesData, setRulesData] = useState<any[]>([]);
  const [investmentsData, setInvestmentsData] = useState<InvestmentsData | null>(null);
  const [forecastData, setForecastData] = useState<Forecast | null>(null);

  const [selectedMonth, setSelectedMonth] = useState<string>("current");
  const [loading, setLoading] = useState<boolean>(true);
  const [tabLoading, setTabLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);

  // Demo Mode fallbacks
  const dash = isDemoMode ? DEMO_DASHBOARD : dashboardData;
  const txData = isDemoMode
    ? { transactions: DEMO_TRANSACTIONS, unreviewedCount: 3, total: DEMO_TRANSACTIONS.length }
    : transactionsData;
  const subData = isDemoMode ? DEMO_SUBSCRIPTIONS : subscriptionsData;
  const nwHistory = isDemoMode ? DEMO_NETWORTH_HISTORY : netWorthHistoryData?.history || [];
  const insights = isDemoMode ? DEMO_INSIGHTS : insightsData;
  const investments: InvestmentsData | null = isDemoMode ? DEMO_INVESTMENTS : investmentsData;
  // Demo runs the same forecast engine over the sample profile
  const demoForecast = useMemo(
    () =>
      isDemoMode
        ? buildForecast({
            startBalance: DEMO_DASHBOARD.totalCash,
            today: localISODate(),
            transactions: DEMO_TRANSACTIONS as any,
            bills: DEMO_SUBSCRIPTIONS.subscriptions as any,
          })
        : null,
    [isDemoMode]
  );
  const forecast = isDemoMode ? demoForecast : forecastData;
  const goals = isDemoMode
    ? [
        { id: "dg_1", name: "Emergency Fund", emoji: "🛡️", targetAmount: 10000, currentAmount: 8500, targetDate: "2026-12-31", category: "Savings", completed: false },
        { id: "dg_2", name: "Vacation Fund", emoji: "✈️", targetAmount: 5000, currentAmount: 2200, targetDate: "2027-04-01", category: "Travel", completed: false },
      ]
    : goalsData;
  const manualAccs = isDemoMode
    ? [
        { id: "dm_1", name: "Crypto Portfolio", emoji: "₿", type: "asset" as const, balance: 4500, notes: "BTC & ETH cold wallet" },
        { id: "dm_2", name: "Car (estimated value)", emoji: "🚗", type: "asset" as const, balance: 22000, notes: "Private sale estimate" },
      ]
    : manualAccountsData;
  const rules = isDemoMode
    ? [
        { id: "dr_1", merchantPattern: "Uber", category: "Transport" },
        { id: "dr_2", merchantPattern: "Whole Foods", category: "Grocery" },
      ]
    : rulesData;

  const refreshTransactions = useCallback(async () => {
    if (isDemoUser) return;
    try {
      const all = await fetchAllTransactions();
      if (all) setTransactionsData(all);
    } catch {}
  }, [isDemoUser]);

  const refreshDashboard = useCallback(async () => {
    if (isDemoUser) return;
    try {
      const dashUrl = selectedMonth !== "current" ? `/api/dashboard?month=${selectedMonth}` : "/api/dashboard";
      const [dashRes, insRes] = await Promise.all([
        fetch(dashUrl),
        fetch('/api/insights'),
      ]);
      if (dashRes.ok) {
        setDashboardData(await dashRes.json());
      }
      if (insRes.ok) {
        setInsightsData(await insRes.json());
      }
    } catch {}
  }, [selectedMonth, isDemoUser]);

  const fetchAllData = useCallback(async (isInitial: boolean = false, showSkeleton: boolean = false, isDemoOverride?: boolean) => {
    if (isDemoUser || isDemoOverride) {
      if (isInitial) setLoading(false);
      if (showSkeleton) setTabLoading(false);
      return;
    }
    if (isInitial) setLoading(true);
    else if (showSkeleton) setTabLoading(true);
    try {
      const dashUrl = selectedMonth !== "current" ? `/api/dashboard?month=${selectedMonth}` : "/api/dashboard";
      const [dashRes, txRes, subRes, nwRes, insRes, goalsRes, manualRes, rulesRes, invRes, fcRes] =
        await Promise.all([
          fetch(dashUrl),
          fetchAllTransactions(),
          fetch("/api/subscriptions"),
          fetch("/api/networth-history"),
          fetch("/api/insights"),
          fetch("/api/goals").catch(() => null),
          fetch("/api/manual-accounts").catch(() => null),
          fetch("/api/rules").catch(() => null),
          fetch("/api/investments").catch(() => null),
          fetch("/api/forecast").catch(() => null),
        ]);

      const dashJson = await dashRes.json();
      const txJson = txRes;
      const subsJson = await subRes.json();
      const nwJson = await nwRes.json();
      const insJson = await insRes.json();
      const goalsJson = goalsRes ? await goalsRes.json() : [];
      const manualJson = manualRes ? await manualRes.json() : [];
      const rulesJson = rulesRes ? await rulesRes.json() : [];

      setDashboardData(dashJson);
      setTransactionsData(txJson);
      setSubscriptionsData(subsJson);
      setNetWorthHistoryData(nwJson);
      setInsightsData(insJson);
      if (Array.isArray(goalsJson)) setGoalsData(goalsJson);
      if (Array.isArray(manualJson)) setManualAccountsData(manualJson);
      if (Array.isArray(rulesJson)) setRulesData(rulesJson);
      if (fcRes?.ok) setForecastData(await fcRes.json());
      // Investments tables may not exist yet (schema not pushed) — keep the rest of the app working
      if (invRes?.ok) setInvestmentsData(await invRes.json());
      else setInvestmentsData({
        totalValue: 0, totalCost: 0, totalGain: 0, totalGainPct: 0, positions: [], allocation: [],
        concentrated: [], institutions: [], unitemized: [], history: [], activity: [], needsConsent: [],
      });
    } catch (err) {
      console.error("Error loading Personal Finance data:", err);
    } finally {
      if (isInitial) setLoading(false);
      if (showSkeleton) setTabLoading(false);
    }
  }, [selectedMonth, isDemoUser]);


  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/check");
      const data = await res.json();
      if (data.authenticated) {
        setIsAuthenticated(true);
        if (data.isDemo) {
          setIsDemoUser(true);
          setIsDemoMode(true);
          setLoading(false);
          setTabLoading(false);
        } else {
          setIsDemoUser(false);
          fetchAllData(true);
        }
      } else {
        setIsAuthenticated(false);
        setLoading(false);
      }
    } catch {
      setIsAuthenticated(false);
      setLoading(false);
    }
  }, [fetchAllData]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/plaid/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || "Sync failed. Check your connection and try again.", "error");
      } else if (data.failedItems?.length) {
        showToast(`Couldn't sync ${data.failedItems.join(", ")}. Open Banks to reconnect.`, "error");
      } else {
        const n = data.syncedTransactionsCount || 0;
        showToast(n > 0 ? `Up to date · ${n} new transaction${n === 1 ? "" : "s"}` : "Everything is up to date", "success");
      }
      await fetchAllData(false);
    } catch (err) {
      console.error("Sync error:", err);
      showToast("Sync failed. Check your connection and try again.", "error");
    } finally {
      setSyncing(false);
    }
  };

  const handleLockApp = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error('Logout request failed:', err);
    }
    setIsAuthenticated(false);
  };

  if (isAuthenticated === false) {
    return (
      <LoginScreen
        onLoginSuccess={(isDemo) => {
          if (isDemo) {
            setIsDemoUser(true);
            setIsDemoMode(true);
            setLoading(false);
            setTabLoading(false);
          } else {
            setIsDemoUser(false);
            fetchAllData(true);
          }
          setIsAuthenticated(true);
        }}
      />
    );
  }

  // Until the session check finishes, show a neutral splash (no app chrome, no data requests)
  if (isAuthenticated === null) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-5" role="status" aria-label="Loading">
        <LogoMark size="lg" />
        <div className="w-6 h-6 rounded-full border-[3px] border-white/10 border-t-sys-blue animate-spin" />
      </div>
    );
  }

  const current = navItem(activeTab);
  // The period picker only changes Overview and Budgets data
  const showPeriod = activeTab === "dashboard" || activeTab === "budgets";
  const rewards = analyzeCreditCardRewards(dash?.accounts || []);
  const accountsCount = dash?.accounts?.length || 0;
  const unreviewed = txData?.unreviewedCount || 0;


  const MonthPicker = (
    <div className="relative w-fit">
      <select
        value={selectedMonth}
        onChange={(e) => setSelectedMonth(e.target.value)}
        aria-label="Time period"
        className="appearance-none bg-transparent hover:bg-white/[0.08] text-white text-[13px] font-semibold pl-3.5 pr-8 py-1.5 rounded-full cursor-pointer transition"
      >
        {periods.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-surface">
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="w-3.5 h-3.5 text-label-2 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );

  const ToolbarActions = (
    <div className="flex items-center gap-1">
      {!isDemoUser && (
        <button
          onClick={() => {
            const next = !isDemoMode;
            setIsDemoMode(next);
            if (next) setTabLoading(false);
          }}
          aria-label={isDemoMode ? "Exit demo mode" : "Enter demo mode"}
          title={isDemoMode ? "Exit demo mode" : "Preview with sample data"}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition active:scale-95 ${
            isDemoMode ? "bg-sys-orange/20 text-sys-orange" : "glass-button text-label-2 hover:text-white"
          }`}
        >
          <Sparkles className="w-4 h-4" />
        </button>
      )}
      {!isDemoMode && (
        <button
          onClick={handleManualSync}
          disabled={syncing}
          aria-label="Sync accounts"
          title="Sync accounts"
          className="w-8 h-8 rounded-full flex items-center justify-center glass-button text-label-2 hover:text-white transition active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin text-sys-blue" : ""}`} />
        </button>
      )}
      {!isDemoMode && <NotificationsButton onMessage={showToast} />}
      {!isDemoMode && <PlaidLinkButton onSuccessSync={() => fetchAllData(false)} />}
    </div>
  );

  return (
    <div className="min-h-[100dvh] text-white antialiased overflow-x-hidden">
      {/* ── Sidebar (iPad / Mac) ───────────────────────────── */}
      <aside className="hidden md:flex fixed top-3 bottom-3 left-3 z-40 w-[240px] flex-col liquid-glass lens rounded-[28px] overflow-hidden">
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-2.5">
            <LogoMark size="sm" />
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-tight">Personal Finance</div>
              <div className="text-[11px] text-label-2">{isDemoMode ? "Demo" : "Private Vault"}</div>
            </div>
          </div>
        </div>

        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto no-scrollbar px-3 pb-4 space-y-5">
          {NAV_SECTIONS.map((section) => (
            <div key={section.heading}>
              <div className="px-2.5 mb-1 text-[11px] font-semibold text-label-3 uppercase tracking-[0.04em]">
                {section.heading}
              </div>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  const count = item.id === "transactions" ? unreviewed : item.id === "accounts" ? accountsCount : 0;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => setActiveTab(item.id)}
                        aria-current={active ? "page" : undefined}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-[10px] text-[14px] transition-colors ${
                          active ? "glass-pill text-white font-semibold" : "text-white/80 hover:bg-white/[0.06]"
                        }`}
                      >
                        <span
                          className="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center shrink-0"
                          style={{ background: item.tile }}
                        >
                          <Icon className="w-[15px] h-[15px] text-[#fff]" strokeWidth={2.4} />
                        </span>
                        <span className="flex-1 text-left">{item.label}</span>
                        {count > 0 && (
                          <span
                            className={`text-[12px] tabular-nums ${
                              item.id === "transactions"
                                ? "min-w-[20px] px-1.5 rounded-full bg-sys-red text-[#fff] font-semibold text-center"
                                : "text-label-3"
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-white/[0.08] space-y-0.5">
          {!isDemoUser && <PasskeySetup variant="sidebar" onMessage={showToast} />}
          <button
            onClick={handleLockApp}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] text-[14px] text-white/80 hover:bg-white/[0.06] transition"
          >
            <span className="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center bg-[#48484A]">
              <Lock className="w-[14px] h-[14px] text-[#fff]" strokeWidth={2.4} />
            </span>
            {isDemoUser ? "Sign Out" : "Lock Vault"}
          </button>
          {!isDemoUser && <SignOutEverywhere variant="sidebar" onSignedOut={() => setIsAuthenticated(false)} />}
        </div>
      </aside>

      {/* ── Content column ─────────────────────────────────── */}
      <div className="md:pl-[264px]">
        {/* Compact top bar (iPhone) */}
        <header className="md:hidden sticky top-0 z-30 pt-[env(safe-area-inset-top,0px)]">
          <div className="absolute inset-0 -bottom-6 scroll-edge-top pointer-events-none" aria-hidden="true" />
          <div className="relative h-14 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LogoMark size="sm" />
              <span className="text-[17px] font-semibold tracking-tight">Personal Finance</span>
            </div>
            <div className="liquid-glass lens rounded-full p-1 flex items-center gap-1">
              {ToolbarActions}
              <button
                onClick={handleLockApp}
                aria-label={isDemoUser ? "Sign out" : "Lock vault"}
                className="w-8 h-8 rounded-full flex items-center justify-center glass-button text-label-2"
              >
                <Lock className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Desktop toolbar */}
        <header className="hidden md:block sticky top-0 z-30">
          <div className="absolute inset-0 -bottom-8 scroll-edge-top pointer-events-none" aria-hidden="true" />
          <div className="relative h-[68px] max-w-[1180px] mx-auto px-8 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-label-2">{current.title}</span>
            {(showPeriod || !isDemoUser) && (
            <div className="liquid-glass lens rounded-full p-1 flex items-center gap-1">
                {showPeriod && MonthPicker}
                {showPeriod && !isDemoMode && <span className="w-px h-5 bg-white/10" aria-hidden="true" />}
                {!isDemoMode && (
                  <QuickAddTransaction variant="toolbar" accounts={dash?.accounts || []} onSuccess={() => fetchAllData(false)} />
                )}
                {ToolbarActions}
              </div>
            )}
          </div>
        </header>

        {isDemoMode && (
          <div className="max-w-[1180px] mx-auto px-4 md:px-8 pt-4">
            <div className="flex items-center gap-3 rounded-2xl bg-sys-orange/[0.12] px-4 py-2.5">
              <Sparkles className="w-4 h-4 text-sys-orange shrink-0" />
              <p className="flex-1 text-[13px] text-white/90">
                <span className="font-semibold">Demo Mode</span>
                <span className="text-label-2"> · Sample data for Alex Chen. No real accounts are shown.</span>
              </p>
              <button
                onClick={isDemoUser ? handleLockApp : () => setIsDemoMode(false)}
                className="text-[13px] font-semibold text-sys-orange hover:opacity-80 flex items-center gap-1"
              >
                {isDemoUser ? "Sign Out" : <><X className="w-3.5 h-3.5" />Exit</>}
              </button>
            </div>
          </div>
        )}

        <main className="max-w-[1180px] mx-auto px-4 md:px-8 pt-5 md:pt-8 pb-32 md:pb-16">
          {/* Large title */}
          <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-label-2 uppercase tracking-[0.03em]">
                {activeTab === "dashboard" ? today || "\u00a0" : current.subtitle}
              </p>
              <h1 className="large-title mt-0.5">{activeTab === "dashboard" ? "Overview" : current.title}</h1>
            </div>
            {showPeriod && <div className="md:hidden liquid-glass lens rounded-full p-1 w-fit">{MonthPicker}</div>}
          </div>

          {loading && !isDemoMode ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4" role="status" aria-label="Loading">
              <div className="w-8 h-8 rounded-full border-[3px] border-white/10 border-t-sys-blue animate-spin" />
              <p className="text-[13px] text-label-2">Loading your accounts…</p>
            </div>
          ) : tabLoading ? (
            <TabSkeleton tab={activeTab} />
          ) : (
            <div key={activeTab} className="view-enter space-y-6 md:space-y-8">
              {activeTab === "dashboard" && (
                <>
                  {/* Quick entry to Ask */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!overviewQuestion.trim()) return setActiveTab("ask");
                      setAskSeed(overviewQuestion.trim());
                      setOverviewQuestion("");
                      setActiveTab("ask");
                    }}
                    className="liquid-glass lens rounded-full p-1.5 pl-4 flex items-center gap-2"
                  >
                    <MessageCircle className="w-[18px] h-[18px] text-sys-blue shrink-0" />
                    <label htmlFor="overview-ask" className="sr-only">Ask about your money</label>
                    <input
                      id="overview-ask"
                      value={overviewQuestion}
                      onChange={(e) => setOverviewQuestion(e.target.value)}
                      placeholder="Ask about your money…"
                      className="flex-1 min-w-0 bg-transparent py-1.5 text-[16px] placeholder:text-label-3 !shadow-none !border-0"
                    />
                    <button
                      type="submit"
                      aria-label="Ask"
                      className="w-9 h-9 rounded-full flex items-center justify-center bg-sys-blue text-[#fff] shrink-0 transition active:scale-90"
                    >
                      <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
                    </button>
                  </form>
                  <CopilotHeader
                    netWorth={dash?.netWorth || 0}
                    totalAssets={dash?.totalAssets || 0}
                    totalCash={dash?.totalCash || 0}
                    totalInvestments={dash?.totalInvestments || 0}
                    totalCreditDebt={dash?.totalCreditDebt || 0}
                    creditCardDebt={dash?.creditCardDebt}
                    loanDebt={dash?.loanDebt || 0}
                    currentMonthIncome={dash?.currentMonthIncome || 0}
                    currentMonthExpenses={dash?.currentMonthExpenses || 0}
                    totalBudgetLimit={dash?.budgetProgress?.reduce((a: number, b: any) => a + Math.max(0, b.effectiveLimit ?? b.monthlyLimit), 0) || 0}
                    unreviewedCount={unreviewed}
                    creditInstitutions={Array.from(
                      new Set(
                        (dash?.accounts || [])
                          .filter((a: any) => a.type === "credit" || a.subtype?.toLowerCase().includes("credit"))
                          .map((a: any) => a.institutionName)
                          .filter(Boolean)
                      )
                    )}
                    history={nwHistory}
                    onRefresh={() => fetchAllData(false)}
                  />
                  <CashFlowChart
                    currentMonthIncome={dash?.currentMonthIncome || 0}
                    currentMonthExpenses={dash?.currentMonthExpenses || 0}
                    categorySpending={dash?.categorySpending || {}}
                  />
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                    <div className="lg:col-span-2">
                      <NetWorthTrendChart currentNetWorth={dash?.netWorth || 0} history={nwHistory} />
                    </div>
                    <UpcomingBillsTimeline subscriptions={subData?.subscriptions || []} />
                  </div>
                  <ForecastCard forecast={forecast} />
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 items-start">
                    <RecentTransactions
                      transactions={txData?.transactions || []}
                      onSeeAll={() => setActiveTab("transactions")}
                    />
                    <CardRewardsMaximizer {...rewards} />
                  </div>
                </>
              )}

              {activeTab === "budgets" && (
                <CopilotBudgets
                  budgets={dash?.budgetProgress || []}
                  transactions={txData?.transactions || []}
                  recurringMerchants={(subData?.subscriptions || [])
                    .filter((s: any) => s.status === "active")
                    .map((s: any) => s.merchantName || s.name)}
                  onUpdateBudget={() => fetchAllData(false)}
                />
              )}

              {activeTab === "goals" && <GoalsTracker goals={goals} onRefresh={() => fetchAllData(false)} />}

              {activeTab === "investments" && (
                <InvestmentsView data={investments} onRefresh={() => fetchAllData(false)} demo={isDemoMode} />
              )}

              {activeTab === "ask" && <AskView initialQuestion={askSeed} onConsumeInitial={() => setAskSeed(null)} />}

              {activeTab === "mom" && <MonthOverMonthView data={insights} />}

              {activeTab === "subscriptions" && (
                <SubscriptionsTracker
                  subscriptions={subData?.subscriptions || []}
                  totalMonthlyCost={subData?.totalMonthlyCost || 0}
                  onRefresh={() => fetchAllData(false)}
                />
              )}

              {activeTab === "accounts" && (
                <>
                  <AccountsList accounts={dash?.accounts || []} onRefresh={() => fetchAllData(false)} />
                  {!isDemoUser && <HealthCard />}
                </>
              )}

              {activeTab === "manual" && (
                <ManualAccountsManager accounts={manualAccs} onRefresh={() => fetchAllData(false)} />
              )}

              {activeTab === "rules" && <RulesManager
                  rules={rules}
                  onRefresh={() => fetchAllData(false)}
                  extraCategories={(dash?.budgetProgress || []).map((b: any) => b.category)}
                />}
            </div>
          )}

          {/* Persistent transactions register — stays mounted so search & filters survive tab switches */}
          {!(loading && !isDemoMode) && !tabLoading && (
            <div className={activeTab === "transactions" ? "block" : "hidden"}>
              <TransactionsView
                transactions={txData?.transactions || []}
                accounts={dash?.accounts || []}
                budgets={dash?.budgetProgress || []}
                unreviewedCount={unreviewed}
                onRefresh={() => {
                  // Edits change totals and budgets too, not just the list
                  refreshTransactions();
                  refreshDashboard();
                }}
              />
            </div>
          )}
        </main>
      </div>

      {toast && (
        <div
          role={toast.tone === "error" ? "alert" : "status"}
          className="fixed left-1/2 -translate-x-1/2 top-[calc(env(safe-area-inset-top,0px)+60px)] md:top-16 z-[60] w-[calc(100%-32px)] max-w-md view-enter"
        >
          <div className="liquid-glass lens rounded-[22px] px-4 py-3 flex items-start gap-3">
            {toast.tone === "error" ? (
              <AlertCircle className="w-5 h-5 text-sys-red shrink-0 mt-px" />
            ) : (
              <CheckCircle2 className={`w-5 h-5 shrink-0 mt-px ${toast.tone === "success" ? "text-sys-green" : "text-sys-blue"}`} />
            )}
            <p className="flex-1 text-[14px] leading-snug">{toast.text}</p>
            <button onClick={() => setToast(null)} aria-label="Dismiss" className="text-label-2 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {!isDemoMode && <QuickAddTransaction variant="fab" accounts={dash?.accounts || []} onSuccess={() => fetchAllData(false)} />}

      {!isDemoUser && <ErrorReporter />}

      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unreviewedCount={unreviewed}
        accountsCount={accountsCount}
        sheetFooter={
          !isDemoUser ? (
            <>
              <PasskeySetup variant="sheet" onMessage={showToast} />
              <SignOutEverywhere variant="sheet" onSignedOut={() => setIsAuthenticated(false)} />
            </>
          ) : null
        }
      />
      <ConfirmHost />
    </div>
  );
}
