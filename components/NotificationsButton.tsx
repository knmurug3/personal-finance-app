"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

type State = "loading" | "unsupported" | "unconfigured" | "off" | "on" | "denied";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Toolbar bell: subscribes this device to Web Push for new-transaction and bank-alert notifications. */
export function NotificationsButton({ onMessage }: { onMessage: (text: string, tone?: "error" | "info") => void }) {
  const [state, setState] = useState<State>("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState("unsupported");
        return;
      }
      try {
        const res = await fetch("/api/push/subscribe");
        const cfg = await res.json();
        if (!res.ok || !cfg.configured) {
          setState("unconfigured");
          return;
        }
        setPublicKey(cfg.publicKey);
        if (Notification.permission === "denied") return setState("denied");
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = await reg?.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      } catch {
        setState("unconfigured");
      }
    })();
  }, []);

  if (state === "loading" || state === "unconfigured") return null;

  const toggle = async () => {
    if (state === "unsupported") {
      onMessage("To get notifications on iPhone, add Personal Finance to your Home Screen first (Share → Add to Home Screen).", "info");
      return;
    }
    if (state === "denied") {
      onMessage("Notifications are blocked for this site. Allow them in your browser settings.", "info");
      return;
    }
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();

      if (state === "on" && existing) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        await existing.unsubscribe();
        setState("off");
        onMessage("Notifications turned off.", "info");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const sub =
        existing ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey!) }));
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth }),
      });
      if (!res.ok) throw new Error("subscribe failed");
      setState("on");
      onMessage("Notifications on. You'll hear about new transactions and bank issues.", "info");
    } catch {
      onMessage("Couldn't turn on notifications. Try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const on = state === "on";
  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={on}
      aria-label={on ? "Turn off notifications" : "Turn on notifications"}
      title={on ? "Notifications on" : "Turn on notifications"}
      className={`w-8 h-8 rounded-full flex items-center justify-center transition active:scale-95 disabled:opacity-50 ${
        on ? "bg-sys-blue/20 text-sys-blue" : "glass-button text-label-2 hover:text-white"
      }`}
    >
      {on ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
    </button>
  );
}
