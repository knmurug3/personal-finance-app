"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle2, AlertTriangle } from "lucide-react";
import { checkedFetch } from "@/lib/notify";

interface ErrorEventRow {
  id: string;
  source: string;
  message: string;
  count: number;
  lastSeen: string;
}

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

/** App health: problems recorded in the last 7 days (sync failures, server and app errors). */
export function HealthCard() {
  const [events, setEvents] = useState<ErrorEventRow[] | null>(null);

  const load = () =>
    fetch("/api/errors")
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d) => setEvents(d.events))
      .catch(() => setEvents([]));

  useEffect(() => {
    load();
  }, []);

  if (events === null) return null;

  const clear = async () => {
    if (await checkedFetch("/api/errors", { method: "DELETE" }, "Couldn't clear the list.")) setEvents([]);
  };

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`w-10 h-10 rounded-full flex items-center justify-center ${events.length ? "bg-sys-orange/15" : "bg-sys-green/15"}`}>
            {events.length ? <Activity className="w-5 h-5 text-sys-orange" /> : <CheckCircle2 className="w-5 h-5 text-sys-green" />}
          </span>
          <div>
            <h3 className="text-[17px] font-semibold">App Health</h3>
            <p className="text-[13px] text-label-2">
              {events.length ? `${events.length} problem${events.length === 1 ? "" : "s"} in the last 7 days` : "No problems in the last 7 days"}
            </p>
          </div>
        </div>
        {events.length > 0 && (
          <button onClick={clear} className="btn-gray">
            Clear
          </button>
        )}
      </div>
      {events.length > 0 && (
        <ul className="mt-4 divide-y divide-white/[0.08]">
          {events.map((e) => (
            <li key={e.id} className="py-2.5 flex items-start gap-3 text-[14px]">
              <AlertTriangle className="w-4 h-4 text-sys-orange mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {e.source}
                  {e.count > 1 && <span className="text-label-3 font-normal"> · {e.count}×</span>}
                </div>
                <div className="text-[13px] text-label-2 break-words">{e.message}</div>
              </div>
              <span className="text-[12px] text-label-3 shrink-0">{ago(e.lastSeen)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
