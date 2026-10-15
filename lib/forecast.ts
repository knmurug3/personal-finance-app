import { isExpenseTransaction, isIncomeTransaction } from "@/lib/financeUtils";
import { roundMoney } from "@/lib/money";

/**
 * Cash-flow forecast: start from today's cash, then walk forward day by day
 * applying detected paychecks, scheduled recurring bills, and a typical daily
 * amount of everyday spending. Pure (no I/O) so it runs on the server and in demo mode.
 */

export interface ForecastTx {
  date: Date | string;
  amount: number; // Plaid convention: positive = money out
  name: string;
  merchantName?: string | null;
  category: string;
}

export interface ForecastBill {
  name: string;
  merchantName?: string | null;
  amount: number;
  frequency: string;
  nextDueDate: Date | string;
}

export interface ForecastEvent {
  date: string; // YYYY-MM-DD
  name: string;
  amount: number; // + money in, − money out
  kind: "paycheck" | "bill";
}

export interface Paycheck {
  name: string;
  amount: number;
  cadence: "weekly" | "biweekly" | "semimonthly" | "monthly";
}

export interface Forecast {
  startBalance: number;
  dailySpend: number;
  days: { date: string; balance: number }[];
  events: ForecastEvent[];
  lowest: { date: string; balance: number };
  endBalance: number;
  threshold: number;
  belowThreshold: boolean;
  paychecks: Paycheck[];
}

const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const toDate = (v: Date | string) => (v instanceof Date ? v : new Date(String(v).length === 10 ? `${v}T00:00:00Z` : v));
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const addMonthsUTC = (d: Date, n: number, day = d.getUTCDate()) => {
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, Math.min(day, last)));
};

/** Recurring income streams (payroll, etc.) from the last few months of deposits. */
export function detectPaychecks(transactions: ForecastTx[], today: Date) {
  const since = today.getTime() - 120 * DAY;
  const groups = new Map<string, { date: Date; amount: number }[]>();
  for (const t of transactions) {
    const date = toDate(t.date);
    if (date.getTime() < since || date > today || t.amount >= 0 || !isIncomeTransaction(t)) continue;
    const key = (t.merchantName || t.name).trim();
    (groups.get(key) ?? groups.set(key, []).get(key)!).push({ date, amount: -t.amount });
  }

  const streams: (Paycheck & { next: (after: Date, until: Date) => Date[] })[] = [];
  for (const [name, list] of groups) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.date.getTime() - b.date.getTime());
    const gaps = list.slice(1).map((x, i) => (x.date.getTime() - list[i].date.getTime()) / DAY);
    const gap = median(gaps);
    const amount = roundMoney(median(list.slice(-3).map((x) => x.amount)));
    const last = list[list.length - 1].date;
    const daysOfMonth = [...new Set(list.slice(-4).map((x) => x.date.getUTCDate()))].sort((a, b) => a - b);

    let cadence: Paycheck["cadence"] | null = null;
    if (gap >= 6 && gap <= 8) cadence = "weekly";
    else if (gap >= 12 && gap <= 17)
      // Same two days of the month (e.g. 1st & 15th) with uneven gaps = twice a month
      cadence = daysOfMonth.length === 2 && gaps.some((g) => Math.abs(g - 14) > 0.5) ? "semimonthly" : "biweekly";
    else if (gap >= 27 && gap <= 33) cadence = "monthly";
    if (!cadence) continue;

    const c = cadence;
    streams.push({
      name,
      amount,
      cadence: c,
      next: (after, until) => {
        const out: Date[] = [];
        if (c === "weekly" || c === "biweekly") {
          const step = (c === "weekly" ? 7 : 14) * DAY;
          for (let t = last.getTime() + step; t <= until.getTime(); t += step) if (t > after.getTime()) out.push(new Date(t));
        } else if (c === "semimonthly") {
          for (let m = 0; m <= 3; m++)
            for (const dom of daysOfMonth) {
              const d = addMonthsUTC(new Date(Date.UTC(after.getUTCFullYear(), after.getUTCMonth(), 1)), m, dom);
              if (d > after && d <= until && d > last) out.push(d);
            }
        } else {
          for (let m = 1; m <= 4; m++) {
            const d = addMonthsUTC(last, m);
            if (d > after && d <= until) out.push(d);
          }
        }
        return out;
      },
    });
  }
  return streams;
}

/** Occurrences of a recurring bill between (after, until]. */
export function billOccurrences(bill: ForecastBill, after: Date, until: Date): Date[] {
  const f = bill.frequency.toLowerCase();
  const anchor = toDate(bill.nextDueDate);
  const out: Date[] = [];
  // Every occurrence is computed from the anchor, so a bill on the 31st stays on the
  // last day of each month instead of drifting to the 30th after a short month.
  const months = f === "quarterly" ? 3 : f === "yearly" || f === "annual" ? 12 : f === "weekly" || f === "biweekly" ? 0 : 1;
  const stepDays = f === "weekly" ? 7 : f === "biweekly" ? 14 : 0;
  for (let i = 0; i < 400; i++) {
    const d = months ? addMonthsUTC(anchor, i * months, anchor.getUTCDate()) : new Date(anchor.getTime() + i * stepDays * DAY);
    if (d > until) break;
    if (d > after) out.push(d);
  }
  return out;
}

export function buildForecast(input: {
  startBalance: number;
  today: string; // owner's YYYY-MM-DD
  transactions: ForecastTx[];
  bills: ForecastBill[];
  days?: number;
  threshold?: number;
}): Forecast {
  const horizon = input.days ?? 60;
  const threshold = input.threshold ?? 500;
  const today = new Date(`${input.today}T00:00:00Z`);
  const until = new Date(today.getTime() + horizon * DAY);

  const events: ForecastEvent[] = [];
  const streams = detectPaychecks(input.transactions, today);
  for (const s of streams) for (const d of s.next(today, until)) events.push({ date: ymd(d), name: s.name, amount: s.amount, kind: "paycheck" });
  for (const b of input.bills) {
    for (const d of billOccurrences(b, today, until)) events.push({ date: ymd(d), name: b.name, amount: -Math.abs(b.amount), kind: "bill" });
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);

  // Everyday spending: last 60 days of expenses, excluding the scheduled bills themselves
  const billNames = new Set(input.bills.flatMap((b) => [b.name, b.merchantName ?? ""]).map((n) => n.toLowerCase().trim()).filter(Boolean));
  const window = 60;
  const since = today.getTime() - window * DAY;
  const everyday = input.transactions
    .filter((t) => {
      const d = toDate(t.date).getTime();
      return d > since && d <= today.getTime() && t.amount > 0 && isExpenseTransaction(t) && !billNames.has((t.merchantName || t.name).toLowerCase().trim());
    })
    .reduce((s, t) => s + t.amount, 0);
  const dailySpend = roundMoney(everyday / window);

  const byDate = new Map<string, number>();
  for (const e of events) byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.amount);

  let balance = input.startBalance;
  let lowest = { date: input.today, balance: roundMoney(balance) };
  const days = [{ date: input.today, balance: roundMoney(balance) }];
  for (let i = 1; i <= horizon; i++) {
    const date = ymd(new Date(today.getTime() + i * DAY));
    balance += (byDate.get(date) ?? 0) - dailySpend;
    const point = { date, balance: roundMoney(balance) };
    days.push(point);
    if (point.balance < lowest.balance) lowest = point;
  }

  return {
    startBalance: roundMoney(input.startBalance),
    dailySpend,
    days,
    events,
    lowest,
    endBalance: days[days.length - 1].balance,
    threshold,
    belowThreshold: lowest.balance < threshold,
    paychecks: streams.map(({ name, amount, cadence }) => ({ name, amount, cadence })),
  };
}
