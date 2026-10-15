import { db } from "@/lib/db";
import { appToday } from "@/lib/appTime";
import { buildForecast } from "@/lib/forecast";
import { sendPushToAll } from "@/lib/push";

export const LOW_BALANCE_THRESHOLD = Number(process.env.FORECAST_LOW_BALANCE || 500);

/** Forecast from the owner's live data: cash accounts, last 120 days, active bills. */
export async function ownerForecast(days = 60) {
  const today = appToday();
  const since = new Date(Date.now() - 120 * 86_400_000);
  const [accounts, transactions, bills] = await Promise.all([
    db.account.findMany({ where: { type: "depository" }, select: { currentBalance: true } }),
    db.transaction.findMany({
      where: { date: { gte: since }, pending: false },
      select: { date: true, amount: true, name: true, merchantName: true, category: true },
    }),
    db.subscription.findMany({ where: { status: "active" } }),
  ]);
  return buildForecast({
    startBalance: accounts.reduce((s, a) => s + a.currentBalance, 0),
    today: today.iso,
    transactions,
    bills,
    days,
    threshold: LOW_BALANCE_THRESHOLD,
  });
}

/** At most one low-balance warning per week. */
export async function checkForecastAlert() {
  const f = await ownerForecast(30);
  if (!f.belowThreshold) return false;
  const week = Math.floor(Date.now() / (7 * 86_400_000));
  const key = `forecastAlert:${week}`;
  if (await db.appMeta.findUnique({ where: { key } })) return false;
  await db.appMeta.create({ data: { key, value: f.lowest.date } });
  const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  const when = new Date(`${f.lowest.date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  await sendPushToAll({
    title: "Cash could run low",
    body: `Projected ${usd(f.lowest.balance)} on ${when}, below your ${usd(f.threshold)} cushion.`,
    url: "/?tab=dashboard",
  });
  return true;
}
