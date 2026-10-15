export function detectAnomalies(transactions: any[]): { category: string; currentSpend: number; avgSpend: number; multiplier: number }[] {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const currentMonthSpend: Record<string, number> = {};
  const last3MonthsSpend: Record<string, number> = {};

  transactions.forEach((tx) => {
    // positive amount indicates expense
    if (tx.amount <= 0) return;

    const txDate = new Date(tx.date);
    const txMonth = txDate.getMonth();
    const txYear = txDate.getFullYear();

    const monthDiff = (currentYear - txYear) * 12 + (currentMonth - txMonth);

    if (monthDiff === 0) {
      currentMonthSpend[tx.category] = (currentMonthSpend[tx.category] || 0) + tx.amount;
    } else if (monthDiff > 0 && monthDiff <= 3) {
      last3MonthsSpend[tx.category] = (last3MonthsSpend[tx.category] || 0) + tx.amount;
    }
  });

  const anomalies: { category: string; currentSpend: number; avgSpend: number; multiplier: number }[] = [];

  Object.keys(currentMonthSpend).forEach((category) => {
    const currentSpend = currentMonthSpend[category];
    const avgSpend = (last3MonthsSpend[category] || 0) / 3;

    if (avgSpend > 20 && currentSpend > avgSpend * 1.5) {
      anomalies.push({
        category,
        currentSpend,
        avgSpend,
        multiplier: currentSpend / avgSpend
      });
    }
  });

  return anomalies;
}
