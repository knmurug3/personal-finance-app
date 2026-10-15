"use client";

import { CreditCard } from "lucide-react";
import { CategoryRewardRecommendation } from "@/lib/rewards";

interface CardRewardsMaximizerProps {
  recommendations: CategoryRewardRecommendation[];
  creditCardsCount: number;
}

/** "Which card should I use?" — best card per spending category, as an inset grouped list. */
export function CardRewardsMaximizer({ recommendations, creditCardsCount }: CardRewardsMaximizerProps) {
  if (recommendations.length === 0) return null;

  return (
    <section>
      <div className="flex items-end justify-between mb-2 px-1">
        <div>
          <h3 className="text-[20px] font-semibold tracking-tight">Best Card to Use</h3>
          <p className="text-[13px] text-label-2">
            Based on your {creditCardsCount} credit card{creditCardsCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <div className="card overflow-hidden">
        <ul>
          {recommendations.map((rec, i) => {
            const isBonus = rec.multiplier !== "Base rate";
            return (
              <li key={rec.category} className="flex items-center gap-3 pl-4">
                <span className="w-10 h-10 rounded-full bg-white/[0.07] flex items-center justify-center text-[18px] shrink-0">
                  {rec.emoji}
                </span>
                <div
                  className={`flex-1 min-w-0 flex items-center justify-between gap-3 py-3 pr-4 ${
                    i < recommendations.length - 1 ? "border-b-[0.5px] border-white/[0.1]" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[15px] font-medium truncate">{rec.category.replace(/\s*\(.*\)$/, "")}</div>
                    <div className="text-[13px] text-label-2 flex items-center gap-1.5 min-w-0">
                      <CreditCard className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{rec.bestCardName}</span>
                    </div>
                  </div>
                  <span
                    title={rec.reason}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                      isBonus ? "bg-sys-green/15 text-sys-green" : "bg-white/[0.08] text-label-2"
                    }`}
                  >
                    {rec.multiplier}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
