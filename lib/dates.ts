/**
 * Transactions, goals and bills are calendar dates stored at UTC midnight.
 * Formatting them in the viewer's local zone shifts them a day earlier in the
 * Americas, so calendar dates are always formatted in UTC.
 */
export function formatCalendarDate(
  value: string | Date,
  opts: Intl.DateTimeFormatOptions = { month: "numeric", day: "numeric", year: "numeric" }
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

/** The viewer's local calendar date as YYYY-MM-DD (what a date input expects). */
export function localISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Calendar YYYY-MM-DD of a stored (UTC-midnight) date, for date inputs. */
export function calendarISODate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** Whole days from the viewer's today to a stored calendar date (negative = past). */
export function daysUntilCalendarDate(value: string | Date): number {
  const target = calendarISODate(value);
  if (!target) return 0;
  const today = localISODate();
  return Math.round((Date.parse(`${target}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}
