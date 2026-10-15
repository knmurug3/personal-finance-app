"use client";

import { useState } from "react";
import { MonitorSmartphone } from "lucide-react";
import { confirmAction, notify } from "@/lib/notify";

/** Signs out every device, including this one (e.g. after losing a phone). Owner only. */
export function SignOutEverywhere({ variant, onSignedOut }: { variant: "sidebar" | "sheet"; onSignedOut: () => void }) {
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    const ok = await confirmAction({
      title: "Sign out of all devices?",
      message: "Every browser and phone signed in to Personal Finance, including this one, will need to sign in again.",
      confirmLabel: "Sign Out All",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ everywhere: true }),
      });
      if (!res.ok) throw new Error();
      onSignedOut();
    } catch {
      notify("Couldn't sign out other devices. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (variant === "sheet") {
    return (
      <button
        onClick={signOut}
        disabled={busy}
        className="mx-3 mt-3 w-[calc(100%-24px)] flex items-center gap-3 pl-4 pr-4 py-3 rounded-[22px] bg-surface/70 active:bg-white/[0.08] disabled:opacity-50"
      >
        <span className="w-[29px] h-[29px] rounded-[7px] flex items-center justify-center bg-sys-red">
          <MonitorSmartphone className="w-[17px] h-[17px] text-[#fff]" strokeWidth={2.3} />
        </span>
        <span className="flex-1 text-left text-[17px]">Sign Out All Devices</span>
      </button>
    );
  }

  return (
    <button
      onClick={signOut}
      disabled={busy}
      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] text-[14px] text-white/80 hover:bg-white/[0.06] transition disabled:opacity-50"
    >
      <span className="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center bg-sys-red">
        <MonitorSmartphone className="w-[14px] h-[14px] text-[#fff]" strokeWidth={2.4} />
      </span>
      <span className="flex-1 text-left">Sign Out All Devices</span>
    </button>
  );
}
