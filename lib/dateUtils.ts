/**
 * Parses ISO date strings or Date objects safely without UTC midnight timezone shift bugs.
 * e.g., "2026-08-01T00:00:00.000Z" parses as Year: 2026, Month: 7 (August), Day: 1
 * regardless of local user timezone (EST, CST, MST, PST, UTC).
 */
export function parseLocalDate(dateInput: string | Date): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;

  const dateStr = String(dateInput);
  const cleanStr = dateStr.split("T")[0]; // "2026-08-01"
  const parts = cleanStr.split("-").map(Number);

  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    const year = parts[0];
    const month = parts[1] - 1; // 0-indexed month
    const day = parts[2] || 1;
    return new Date(year, month, day);
  }

  return new Date(dateInput);
}

/**
 * Checks if two dates fall in the same calendar month and year.
 */
export function isSameMonth(dateInput1: string | Date, dateInput2: string | Date = new Date()): boolean {
  const d1 = parseLocalDate(dateInput1);
  const d2 = parseLocalDate(dateInput2);
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
}

/**
 * Transactions are stored as calendar dates at UTC midnight, so all month
 * bucketing and range queries use UTC to avoid timezone drift.
 */
export function utcMonthRange(year: number, month0: number): { gte: Date; lt: Date } {
  return { gte: new Date(Date.UTC(year, month0, 1)), lt: new Date(Date.UTC(year, month0 + 1, 1)) };
}

export function utcYearRange(year: number): { gte: Date; lt: Date } {
  return { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) };
}

/** Widens a range so pending/posted pairs straddling the edge can still be matched. */
export function padRange(range: { gte: Date; lt: Date }, days = 7): { gte: Date; lt: Date } {
  const ms = days * 86_400_000;
  return { gte: new Date(range.gte.getTime() - ms), lt: new Date(range.lt.getTime() + ms) };
}
