"use client";

import { Calendar, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatCalendarDate, daysUntilCalendarDate, calendarISODate } from "@/lib/dates";

interface Subscription {
  id: string;
  name: string;
  amount: number;
  nextDueDate: string;
  status: string;
}

interface UpcomingBillsTimelineProps {
  subscriptions: Subscription[];
}

export function UpcomingBillsTimeline({ subscriptions }: UpcomingBillsTimelineProps) {
  const activeSubs = subscriptions.filter((s) => s.status === "active");

  const sortedSubs = [...activeSubs].sort(
    (a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime()
  );

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val);

  return (
    <div className="bg-surface border border-white/[0.08] rounded-[22px] p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-[20px] font-semibold tracking-tight text-white flex items-center gap-2">
            Upcoming Bills
          </h3>
          <p className="text-label-2 text-[13px] mt-0.5">Next charges from your subscriptions</p>
        </div>
      </div>

      <div className="relative pl-6 border-l-2 border-white/[0.08] space-y-6">
        {sortedSubs.map((sub) => {
          const dateFormatted = formatCalendarDate(sub.nextDueDate, { month: "short", day: "numeric" });
          const daysLeft = daysUntilCalendarDate(sub.nextDueDate);

          const isUrgent = daysLeft <= 3;

          return (
            <div key={sub.id} className="relative group">
              {/* Timeline Marker Bullet */}
              <div
                className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 bg-slate-900 ${
                  isUrgent ? "border-amber-400 bg-amber-950" : "border-indigo-500 bg-indigo-950"
                }`}
              />

              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 flex items-center justify-between group-hover:border-white/[0.16] transition">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100 text-sm">{sub.name}</span>
                    {isUrgent && (
                      <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Due Soon
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 mt-1 block">
                    Due {dateFormatted} ({daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? "" : "s"}` : daysLeft === 0 ? "Today" : "Overdue"})
                  </span>
                </div>

                <span className="font-bold text-slate-100 text-sm">
                  {formatCurrency(sub.amount)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
