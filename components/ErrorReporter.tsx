"use client";

import { useEffect } from "react";

// Browser noise that isn't an app problem
const IGNORE = [/ResizeObserver loop/i, /Failed to find script/i, /Script error\.?$/i, /Load failed/i, /AbortError/i];

/** Forwards uncaught browser errors to /api/errors (owner sessions only; max 5 per page load). */
export function ErrorReporter() {
  useEffect(() => {
    let sent = 0;
    const report = (message: string) => {
      if (!message || sent >= 5 || IGNORE.some((r) => r.test(message))) return;
      sent++;
      fetch("/api/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.slice(0, 500), path: window.location.pathname + window.location.search }),
        keepalive: true,
      }).catch(() => {});
    };
    const onError = (e: ErrorEvent) => report(e.message || String(e.error));
    const onRejection = (e: PromiseRejectionEvent) => report(e.reason instanceof Error ? e.reason.message : String(e.reason));
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
