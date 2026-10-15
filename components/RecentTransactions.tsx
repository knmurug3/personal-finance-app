"use client";

import { ChevronRight } from "lucide-react";
import { formatCalendarDate, daysUntilCalendarDate, calendarISODate } from "@/lib/dates";
import { getCategoryEmoji } from "@/lib/categoryEmoji";

interface RecentTransactionsProps {
  transactions: any[];
  onSeeAll: () => void;
  limit?: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

// Inset grouped list of the latest activity — the full register lives on the Transactions tab.
export function RecentTransactions({ transactions, onSeeAll, limit = 6 }: RecentTransactionsProps) {
  const recent = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);

  return (
    <section>
      <div className="flex items-end justify-between mb-2 px-1">
        <h3 className="text-[20px] font-semibold tracking-tight">Recent Activity</h3>
        <button onClick={onSeeAll} className="text-[15px] text-sys-blue hover:opacity-80 flex items-center gap-0.5">
          See All <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="card overflow-hidden">
        {recent.length === 0 ? (
          <p className="p-6 text-center text-[15px] text-label-2">No transactions yet.</p>
        ) : (
          <ul>
            {recent.map((tx, i) => {
              // Plaid convention: positive = money out, negative = money in
              const income = tx.amount < 0;
              return (
                <li key={tx.id} className="flex items-center gap-3 pl-4">
                  <span className="w-10 h-10 rounded-full bg-white/[0.07] flex items-center justify-center text-[18px] shrink-0">
                    {getCategoryEmoji(tx.category || "General")}
                  </span>
                  <div
                    className={`flex-1 min-w-0 flex items-center justify-between gap-3 py-3 pr-4 ${
                      i < recent.length - 1 ? "border-b-[0.5px] border-white/[0.1]" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-[15px] font-medium truncate">{tx.merchantName || tx.name}</div>
                      <div className="text-[13px] text-label-2 truncate">
                        {tx.category || "Uncategorized"} ·{" "}
                        {formatCalendarDate(tx.date, { month: "short", day: "numeric" })}
                        {tx.pending ? " · Pending" : ""}
                      </div>
                    </div>
                    <span className={`text-[15px] font-semibold tabular-nums shrink-0 ${income ? "text-sys-green" : "text-white"}`}>
                      {income ? "+" : "−"}
                      {fmt(Math.abs(tx.amount))}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
