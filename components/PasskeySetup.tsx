"use client";

import { useEffect, useState } from "react";
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { ScanFace } from "lucide-react";

/** Registers this device's Face ID / Touch ID (a passkey) for password-free sign-in. */
export function PasskeySetup({
  variant,
  onMessage,
}: {
  variant: "sidebar" | "sheet";
  onMessage: (text: string, tone?: "error" | "info" | "success") => void;
}) {
  const [supported, setSupported] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
    fetch("/api/auth/passkey")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCount(d ? d.passkeys.length : null))
      .catch(() => setCount(null));
  }, []);

  // Hidden when the browser can't do WebAuthn or the API isn't available (demo / schema not pushed)
  if (!supported || count === null) return null;

  const setup = async () => {
    setBusy(true);
    try {
      const optRes = await fetch("/api/auth/passkey/register");
      if (!optRes.ok) throw new Error((await optRes.json()).error);
      const response = await startRegistration({ optionsJSON: await optRes.json() });
      const name = /iPhone|iPad/.test(navigator.userAgent) ? "iPhone" : /Mac/.test(navigator.userAgent) ? "Mac" : "This device";
      const res = await fetch("/api/auth/passkey/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response, name }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setCount((c) => (c || 0) + 1);
      onMessage("Passkey added. Next time, sign in with Face ID or Touch ID.", "success");
    } catch (err: any) {
      if (err?.name === "NotAllowedError") return; // user cancelled the system prompt
      if (err?.name === "InvalidStateError") {
        onMessage("This device already has a passkey for Personal Finance.", "info");
        return;
      }
      onMessage(err?.message || "Couldn't add a passkey. Try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const label = count > 0 ? "Add Another Passkey" : "Set Up Face ID";

  if (variant === "sheet") {
    return (
      <button
        onClick={setup}
        disabled={busy}
        className="mx-3 mt-3 w-[calc(100%-24px)] flex items-center gap-3 pl-4 pr-4 py-3 rounded-[22px] bg-surface/70 active:bg-white/[0.08] disabled:opacity-50"
      >
        <span className="w-[29px] h-[29px] rounded-[7px] flex items-center justify-center bg-sys-green">
          <ScanFace className="w-[17px] h-[17px] text-[#fff]" strokeWidth={2.3} />
        </span>
        <span className="flex-1 text-left text-[17px]">{label}</span>
        {count > 0 && <span className="text-[15px] text-label-2">{count} saved</span>}
      </button>
    );
  }

  return (
    <button
      onClick={setup}
      disabled={busy}
      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] text-[14px] text-white/80 hover:bg-white/[0.06] transition disabled:opacity-50"
    >
      <span className="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center bg-sys-green">
        <ScanFace className="w-[14px] h-[14px] text-[#fff]" strokeWidth={2.4} />
      </span>
      <span className="flex-1 text-left">{label}</span>
      {count > 0 && <span className="text-[12px] text-label-3">{count}</span>}
    </button>
  );
}
