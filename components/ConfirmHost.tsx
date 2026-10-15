"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ConfirmOptions } from "@/lib/notify";

type Request = ConfirmOptions & { resolve: (ok: boolean) => void };

/** Renders the sheets requested through confirmAction(); mount once per page. */
export function ConfirmHost() {
  const [req, setReq] = useState<Request | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onConfirm = (e: Event) => {
      const next = (e as CustomEvent<Request>).detail;
      // A newer request replaces an unanswered one
      setReq((prev) => {
        prev?.resolve(false);
        return next;
      });
    };
    window.addEventListener("app-confirm", onConfirm);
    return () => window.removeEventListener("app-confirm", onConfirm);
  }, []);

  const close = (ok: boolean) => {
    req?.resolve(ok);
    setReq(null);
  };

  useEffect(() => {
    if (!req) return;
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      // Keep Tab cycling between the two buttons while the sheet is open
      if (e.key === "Tab") {
        e.preventDefault();
        (document.activeElement === cancelRef.current ? confirmRef : cancelRef).current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);

  if (!req) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center bg-black/40 p-3" onClick={() => close(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={req.message ? "confirm-message" : undefined}
        onClick={(e) => e.stopPropagation()}
        className="liquid-glass w-full md:max-w-sm rounded-[28px] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] md:pb-5 text-center view-enter"
      >
        <h3 id="confirm-title" className="text-[17px] font-semibold">
          {req.title}
        </h3>
        {req.message && (
          <p id="confirm-message" className="mt-1.5 text-[14px] text-label-2">
            {req.message}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <button
            ref={cancelRef}
            onClick={() => close(false)}
            className="flex-1 rounded-full py-2.5 text-[15px] font-semibold bg-white/[0.08] hover:bg-white/[0.12]"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            onClick={() => close(true)}
            className={`flex-1 rounded-full py-2.5 text-[15px] font-semibold text-[#fff] ${req.destructive ? "bg-sys-red" : "bg-sys-blue"}`}
          >
            {req.confirmLabel || "OK"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
