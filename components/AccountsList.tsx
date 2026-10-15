"use client";

import { useState } from "react";
import { Building2, AlertTriangle, RefreshCw, CheckCircle2, Wifi } from "lucide-react";
import { PlaidLinkButton } from "./PlaidLinkButton";

interface Account {
  id: string;
  bankItemId?: string;
  name: string;
  officialName?: string;
  type: string;
  subtype?: string;
  mask?: string;
  currentBalance: number;
  availableBalance?: number;
  isoCurrencyCode?: string;
  institutionName?: string;
  status?: string; // "active" | "error" | "broken" | "item_login_required" | "disconnected"
  updatedAt?: string | Date;
  bankItem?: {
    institutionName: string;
    status?: string;
  };
}

interface AccountsListProps {
  accounts: Account[];
  onRefresh?: () => void;
}

export function AccountsList({ accounts, onRefresh }: AccountsListProps) {
  const [syncing, setSyncing] = useState(false);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);

  const isLive = (status?: string) => {
    if (!status) return true;
    const s = status.toLowerCase();
    return s === "active" || s === "live" || s === "connected";
  };

  const activeCount = accounts.filter((a) => isLive(a.status || a.bankItem?.status)).length;
  const brokenCount = accounts.length - activeCount;

  const totalAssets = accounts
    .filter((a) => a.type !== "credit")
    .reduce((sum, a) => sum + (a.currentBalance || 0), 0);
  const totalDebt = accounts
    .filter((a) => a.type === "credit")
    .reduce((sum, a) => sum + (a.currentBalance || 0), 0);

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      await fetch("/api/plaid/sync", { method: "POST" });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setSyncing(false);
    }
  };

  // Wallet-style card faces, tinted by account type
  const cardFace = (acc: Account) => {
    if (acc.type === "credit") return "linear-gradient(135deg, #2C2C2E 0%, #1A1A1C 55%, #3A2A2A 100%)";
    if (acc.type === "investment") return "linear-gradient(135deg, #5E5CE6 0%, #3634A3 60%, #BF5AF2 140%)";
    if (acc.subtype === "savings") return "linear-gradient(135deg, #30D158 0%, #1E8E3E 65%, #0A84FF 160%)";
    return "linear-gradient(135deg, #0A84FF 0%, #0060DF 60%, #5E5CE6 140%)";
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {brokenCount > 0 ? (
              <span className="w-10 h-10 rounded-full bg-sys-red/15 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-sys-red" />
              </span>
            ) : (
              <span className="w-10 h-10 rounded-full bg-sys-green/15 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-sys-green" />
              </span>
            )}
            <div>
              <div className="text-[17px] font-semibold">
                {brokenCount > 0
                  ? `${brokenCount} connection${brokenCount > 1 ? "s" : ""} need attention`
                  : "All accounts up to date"}
              </div>
              <div className="text-[13px] text-label-2">
                {activeCount} of {accounts.length} account{accounts.length === 1 ? "" : "s"} syncing · Secured by Plaid
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSyncAll} disabled={syncing} className="btn-gray disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync"}
            </button>
            <PlaidLinkButton onSuccessSync={onRefresh} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="rounded-2xl bg-white/[0.05] p-4">
            <div className="text-[13px] text-label-2 font-medium">Assets</div>
            <div className="text-[22px] font-display font-semibold tabular-nums tracking-tight">{formatCurrency(totalAssets)}</div>
          </div>
          <div className="rounded-2xl bg-white/[0.05] p-4">
            <div className="text-[13px] text-label-2 font-medium">Credit Balances</div>
            <div className="text-[22px] font-display font-semibold tabular-nums tracking-tight text-sys-red">{formatCurrency(totalDebt)}</div>
          </div>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="card p-12 text-center">
          <span className="w-14 h-14 rounded-full bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-label-2" />
          </span>
          <h4 className="text-[20px] font-semibold">No Accounts Yet</h4>
          <p className="text-[15px] text-label-2 mt-1 max-w-sm mx-auto mb-6">
            Connect checking, savings, investment and credit accounts to see live balances and transactions.
          </p>
          <div className="inline-block">
            <PlaidLinkButton onSuccessSync={onRefresh} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {accounts.map((acc) => {
            const live = isLive(acc.status || acc.bankItem?.status);
            const institution = acc.bankItem?.institutionName || acc.institutionName || "Bank Account";
            const isCredit = acc.type === "credit";

            return (
              <div
                key={acc.id}
                className="group relative aspect-[1.586] rounded-[18px] p-5 flex flex-col justify-between overflow-hidden text-[#fff] shadow-[0_12px_32px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-apple hover:-translate-y-1"
                style={{ background: cardFace(acc) }}
              >
                {/* sheen */}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_0%_0%,rgba(255,255,255,0.28),transparent_55%)]" />
                <div className="pointer-events-none absolute inset-0 rounded-[18px] ring-1 ring-inset ring-[rgba(255,255,255,0.15)]" />

                <div className="relative flex items-start justify-between">
                  <div>
                    <div className="text-[17px] font-semibold tracking-tight">{institution}</div>
                    <div className="text-[12px] text-[rgba(255,255,255,0.70)] capitalize">{acc.subtype || acc.type}</div>
                  </div>
                  {live ? (
                    <Wifi className="w-5 h-5 text-[rgba(255,255,255,0.80)] rotate-90" aria-label="Syncing" />
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-semibold text-sys-red">
                      <AlertTriangle className="w-3 h-3" /> Reconnect
                    </span>
                  )}
                </div>

                <div className="relative">
                  <div className="text-[12px] text-[rgba(255,255,255,0.70)]">{isCredit ? "Balance owed" : "Balance"}</div>
                  <div className="text-[28px] font-display font-semibold tabular-nums tracking-[-0.02em] leading-tight">
                    {formatCurrency(acc.currentBalance)}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[13px] text-[rgba(255,255,255,0.75)]">
                    <span className="truncate pr-3">{acc.name}</span>
                    <span className="tabular-nums tracking-[0.08em] shrink-0">•••• {acc.mask || "0000"}</span>
                  </div>
                </div>

                {!live && (
                  <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3 px-6 text-center">
                    <span className="text-[13px] text-[rgba(255,255,255,0.85)]">
                      {institution} needs you to sign in again to keep syncing.
                    </span>
                    <PlaidLinkButton onSuccessSync={onRefresh} bankItemId={acc.bankItemId} label="Reconnect" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
