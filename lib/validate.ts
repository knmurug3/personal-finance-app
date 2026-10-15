/** Small input validators shared by API routes. */

export function cleanString(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 && t.length <= max ? t : null;
}

export function finiteNumber(v: unknown): number | null {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export const SUBSCRIPTION_FREQUENCIES = ["weekly", "biweekly", "monthly", "quarterly", "yearly", "annual"] as const;
export const SUBSCRIPTION_STATUSES = ["active", "paused", "cancelled", "dismissed"] as const;

/** Tags: up to 20 strings of at most 40 characters. Returns null when invalid. */
export function cleanTags(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length > 20) return null;
  const out: string[] = [];
  for (const t of v) {
    const c = cleanString(t, 40);
    if (!c) return null;
    out.push(c);
  }
  return out;
}

/** A YYYY-MM-DD (or ISO) date string, null to clear, or undefined if absent. Throws-free: returns "invalid". */
export function optionalDate(v: unknown): Date | null | undefined | "invalid" {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (typeof v !== "string") return "invalid";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}
