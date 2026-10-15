/** Rounds to whole cents; balances are stored as floats, so round at every boundary. */
export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Monthly cost of a recurring amount at the given billing frequency. */
export function monthlyEquivalent(amount: number, frequency: string): number {
  const f = (frequency || "monthly").toLowerCase();
  const perYear =
    f === "weekly" ? 52 : f === "biweekly" ? 26 : f === "quarterly" ? 4 : f === "yearly" || f === "annual" ? 1 : 12;
  return roundMoney((amount * perYear) / 12);
}
