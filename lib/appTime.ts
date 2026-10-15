/**
 * "Today" for a single-owner app. Servers run in UTC, so in the evening (US time) a UTC
 * "today" is already tomorrow. Everything that buckets by day or month uses the
 * owner's time zone instead (APP_TIMEZONE, default UTC).
 */
export const APP_TIMEZONE = process.env.APP_TIMEZONE || "UTC";

export function appToday(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const year = get("year");
  const month0 = get("month") - 1;
  const day = get("day");
  const iso = `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { year, month0, day, iso, monthKey: iso.slice(0, 7) };
}

/** The owner's calendar today as a UTC-midnight Date (the storage convention for calendar dates). */
export function appTodayDate(now: Date = new Date()): Date {
  return new Date(`${appToday(now).iso}T00:00:00Z`);
}
