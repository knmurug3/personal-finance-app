import { db } from "@/lib/db";
import { appToday } from "@/lib/appTime";
import { monthBudgetProgress } from "@/lib/budgetProgress";
import { sendPushToAll } from "@/lib/push";

export const ALERT_LEVELS = [80, 100] as const;

const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

/** Highest alert level a budget has reached (0 if none). */
export function alertLevel(spent: number, limit: number): number {
  if (limit <= 0) return spent > 0 ? 100 : 0;
  const pct = (spent / limit) * 100;
  return [...ALERT_LEVELS].reverse().find((lvl) => pct >= lvl) ?? 0;
}

export function alertMessage(category: string, spent: number, limit: number, level: number) {
  return level >= 100
    ? { title: `Over budget: ${category}`, body: `${usd(spent)} spent of ${usd(limit)} this month.` }
    : { title: `${category} at ${Math.round((spent / limit) * 100)}%`, body: `${usd(Math.max(0, limit - spent))} left this month.` };
}

/**
 * Atomically records that `level` was reached; true only for the one caller that raised it,
 * so two syncs finishing together can't both send the same alert.
 */
async function claimAlert(key: string, level: number): Promise<boolean> {
  try {
    await db.appMeta.create({ data: { key, value: String(level) } });
    return true;
  } catch {
    const lower = ALERT_LEVELS.filter((l) => l < level).map(String);
    const { count } = await db.appMeta.updateMany({ where: { key, value: { in: lower } }, data: { value: String(level) } });
    return count === 1;
  }
}

/**
 * Notifies once per category per level per month when spending crosses 80% / 100%.
 * Remembered in AppMeta so repeated syncs don't repeat the alert.
 */
export async function checkBudgetAlerts(): Promise<number> {
  const today = appToday();
  const { progress } = await monthBudgetProgress(today.year, today.month0);
  let sent = 0;
  for (const b of progress) {
    const level = alertLevel(b.spent, b.effectiveLimit);
    if (!level) continue;
    const key = `budgetAlert:${today.monthKey}:${b.category}`;
    if (!(await claimAlert(key, level))) continue;
    await sendPushToAll({ ...alertMessage(b.category, b.spent, b.effectiveLimit, level), url: "/?tab=budgets" });
    sent++;
  }
  return sent;
}
