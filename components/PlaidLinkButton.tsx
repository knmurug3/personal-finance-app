"use client";

import { useEffect, useState, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { RefreshCw, Plus, AlertCircle } from "lucide-react";
import { notify } from "@/lib/notify";

interface PlaidLinkButtonProps {
  onSuccessSync?: () => void;
  /** When set, opens Link in update mode to repair this existing connection. */
  bankItemId?: string;
  label?: string;
  /** With bankItemId: request investments consent instead of a plain reconnect */
  addInvestments?: boolean;
  /** With bankItemId: reopen the institution's account picker */
  selectAccounts?: boolean;
  variant?: "filled" | "tinted";
}

/**
 * Mounted only after the user clicks, so Plaid's script loads on demand. Loading it
 * for every button on render made react-plaid-link throw "Failed to find script"
 * whenever a button unmounted (e.g. switching tabs) before the script arrived.
 */
function PlaidLauncher({
  token,
  onSuccess,
  onDone,
}: {
  token: string;
  onSuccess: (publicToken: string, metadata: any) => void;
  onDone: () => void;
}) {
  const { open, ready } = usePlaidLink({ token, onSuccess, onExit: onDone });
  useEffect(() => {
    if (ready) open();
  }, [ready, open]);
  return null;
}

export function PlaidLinkButton({
  onSuccessSync,
  bankItemId,
  label,
  addInvestments,
  selectAccounts,
  variant = "filled",
}: PlaidLinkButtonProps) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onSuccess = useCallback(
    async (public_token: string, metadata: any) => {
      setToken(null);
      setLoading(true);
      try {
        if (bankItemId) {
          // Update mode keeps the same access token; a sync marks the item active again
          await fetch("/api/plaid/sync", { method: "POST" });
        } else {
          const res = await fetch("/api/plaid/exchange-public-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              publicToken: public_token,
              institutionName: metadata?.institution?.name || "Connected Bank",
            }),
          });
          if (!res.ok) notify("Plaid connected, but saving the bank failed. Try again.");
        }
        onSuccessSync?.();
      } catch (err) {
        console.error("Error linking bank account:", err);
        notify("Couldn't finish connecting the bank. Try again.");
      } finally {
        setLoading(false);
      }
    },
    [onSuccessSync, bankItemId]
  );

  const handleConnectClick = async () => {
    setErrorMessage(null);
    setLoading(true);
    try {
      // A fresh link token per attempt (they expire after a few hours)
      const res = await fetch("/api/plaid/create-link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bankItemId ? { bankItemId, addInvestments, selectAccounts } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (data.link_token) {
        setToken(data.link_token);
      } else {
        setErrorMessage(data.error || "Couldn't start Plaid");
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to connect to Plaid server");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleConnectClick}
        disabled={loading}
        aria-label={label || (bankItemId ? "Reconnect bank" : "Add account")}
        className={`flex items-center justify-center gap-1.5 h-8 min-w-8 rounded-full text-[13px] font-semibold transition active:scale-[0.97] disabled:opacity-60 ${
          variant === "tinted"
            ? "px-3.5 bg-sys-blue/15 hover:bg-sys-blue/25 text-sys-blue"
            : "px-2 sm:px-3.5 bg-sys-blue hover:bg-sys-blue/90 text-[#fff]"
        }`}
      >
        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={2.5} />}
        <span className={variant === "tinted" ? "" : "hidden sm:inline"}>
          {loading ? "Connecting…" : label || (bankItemId ? "Reconnect" : "Add Account")}
        </span>
      </button>

      {token && (
        <PlaidLauncher
          token={token}
          onSuccess={onSuccess}
          onDone={() => {
            setToken(null);
            setLoading(false);
          }}
        />
      )}

      {errorMessage && (
        <span className="text-[12px] text-sys-red flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {errorMessage}
        </span>
      )}
    </div>
  );
}
