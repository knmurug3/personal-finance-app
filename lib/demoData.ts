/**
 * lib/demoData.ts
 * Realistic fake financial data for Personal Finance Demo Mode.
 * Fictional profile: Alex Chen, Software Engineer, San Francisco.
 * All names, amounts, and accounts are completely made up.
 */

import { buildPortfolio } from "./portfolio";
const now = new Date();
const y = now.getFullYear();
const m = now.getMonth();

function d(daysAgo: number, dayOfMonth?: number): string {
  if (dayOfMonth !== undefined) {
    return new Date(y, m, dayOfMonth).toISOString();
  }
  const dt = new Date(now);
  dt.setDate(dt.getDate() - daysAgo);
  return dt.toISOString();
}

function prevMonth(day: number): string {
  return new Date(y, m - 1, day).toISOString();
}

function twoMonthsAgo(day: number): string {
  return new Date(y, m - 2, day).toISOString();
}

// ─── ACCOUNTS ────────────────────────────────────────────────────────────────
export const DEMO_ACCOUNTS = [
  {
    id: "demo_acc_1",
    name: "Everyday Checking",
    mask: "4521",
    type: "depository",
    subtype: "checking",
    currentBalance: 9240.18,
    institutionName: "Demo Bank",
    status: "active",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "demo_acc_2",
    name: "High Yield Savings",
    mask: "8834",
    type: "depository",
    subtype: "savings",
    currentBalance: 28500.0,
    institutionName: "Demo Bank",
    status: "active",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "demo_acc_3",
    name: "Demo Brokerage",
    mask: "2291",
    type: "investment",
    subtype: "brokerage",
    currentBalance: 14820.44,
    institutionName: "Demo Brokerage",
    status: "active",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "demo_acc_4",
    name: "Rewards Credit Card",
    mask: "7732",
    type: "credit",
    subtype: "credit card",
    currentBalance: 2847.31,
    institutionName: "Demo Bank",
    status: "active",
    updatedAt: new Date().toISOString(),
  },
];

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
export const DEMO_TRANSACTIONS = [
  // Current month — income
  { id: "dt_01", accountId: "demo_acc_1", name: "Direct Deposit ACME CORP PAYROLL", merchantName: "ACME Corp", amount: -3600, date: d(0, 1), category: "Income", tags: [], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[0] },
  { id: "dt_02", accountId: "demo_acc_1", name: "Direct Deposit ACME CORP PAYROLL", merchantName: "ACME Corp", amount: -3600, date: d(0, 15), category: "Income", tags: [], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[0] },

  // Current month — housing
  { id: "dt_03", accountId: "demo_acc_4", name: "Rent Payment", merchantName: "Landlord", amount: 2100, date: d(0, 1), category: "Housing", tags: [], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },

  // Current month — food & dining
  { id: "dt_04", accountId: "demo_acc_4", name: "Whole Foods Market", merchantName: "Whole Foods", amount: 143.21, date: d(0, 3), category: "Food & Dining", tags: [], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
  { id: "dt_05", accountId: "demo_acc_4", name: "Starbucks", merchantName: "Starbucks", amount: 7.85, date: d(0, 6), category: "Food & Dining", tags: [], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
  { id: "dt_06", accountId: "demo_acc_4", name: "Chipotle Mexican Grill", merchantName: "Chipotle", amount: 13.45, date: d(0, 11), category: "Food & Dining", tags: [], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
  { id: "dt_07", accountId: "demo_acc_4", name: "Trader Joe's", merchantName: "Trader Joe's", amount: 82.33, date: d(0, 17), category: "Food & Dining", tags: [], reviewed: false, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
  { id: "dt_08", accountId: "demo_acc_4", name: "Whole Foods Market", merchantName: "Whole Foods", amount: 56.44, date: d(0, 22), category: "Food & Dining", tags: [], reviewed: false, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
  { id: "dt_09", accountId: "demo_acc_4", name: "Nobu Restaurant", merchantName: "Nobu", amount: 78.50, date: d(0, 24), category: "Food & Dining", tags: ["dining-out"], reviewed: false, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },

  // Current month — transport
  { id: "dt_10", accountId: "demo_acc_4", name: "Shell Oil", merchantName: "Shell", amount: 68.42, date: d(0, 5), category: "Transport", tags: [], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
  { id: "dt_11", accountId: "demo_acc_4", name: "Uber", merchantName: "Uber", amount: 24.50, date: d(0, 13), category: "Transport", tags: [], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
  { id: "dt_12", accountId: "demo_acc_4", name: "Lyft", merchantName: "Lyft", amount: 18.75, date: d(0, 20), category: "Transport", tags: [], reviewed: false, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },

  // Current month — shopping
  { id: "dt_13", accountId: "demo_acc_4", name: "Amazon.com", merchantName: "Amazon", amount: 67.32, date: d(0, 9), category: "Shopping", tags: [], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
  { id: "dt_14", accountId: "demo_acc_4", name: "Target", merchantName: "Target", amount: 94.18, date: d(0, 15), category: "Shopping", tags: [], reviewed: false, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },

  // Current month — entertainment / subscriptions
  { id: "dt_15", accountId: "demo_acc_4", name: "Spotify USA", merchantName: "Spotify", amount: 9.99, date: d(0, 3), category: "Entertainment", tags: ["subscription"], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
  { id: "dt_16", accountId: "demo_acc_4", name: "Netflix.com", merchantName: "Netflix", amount: 22.99, date: d(0, 8), category: "Entertainment", tags: ["subscription"], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
  { id: "dt_17", accountId: "demo_acc_4", name: "Apple Services", merchantName: "Apple", amount: 2.99, date: d(0, 18), category: "Entertainment", tags: ["subscription"], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
  { id: "dt_18", accountId: "demo_acc_4", name: "Hulu", merchantName: "Hulu", amount: 17.99, date: d(0, 23), category: "Entertainment", tags: ["subscription"], reviewed: false, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },

  // Current month — health & fitness
  { id: "dt_19", accountId: "demo_acc_4", name: "Equinox Fitness", merchantName: "Equinox", amount: 49.99, date: d(0, 12), category: "Health & Fitness", tags: ["subscription"], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
  { id: "dt_20", accountId: "demo_acc_4", name: "CVS Pharmacy", merchantName: "CVS", amount: 28.13, date: d(0, 25), category: "Personal Care", tags: [], reviewed: false, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },

  // Previous month transactions
  { id: "dt_21", accountId: "demo_acc_1", name: "Direct Deposit ACME CORP PAYROLL", merchantName: "ACME Corp", amount: -3600, date: prevMonth(1), category: "Income", tags: [], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[0] },
  { id: "dt_22", accountId: "demo_acc_1", name: "Direct Deposit ACME CORP PAYROLL", merchantName: "ACME Corp", amount: -3600, date: prevMonth(15), category: "Income", tags: [], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[0] },
  { id: "dt_23", accountId: "demo_acc_4", name: "Rent Payment", merchantName: "Landlord", amount: 2100, date: prevMonth(1), category: "Housing", tags: [], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
  { id: "dt_24", accountId: "demo_acc_4", name: "Whole Foods Market", merchantName: "Whole Foods", amount: 167.88, date: prevMonth(5), category: "Food & Dining", tags: [], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
  { id: "dt_25", accountId: "demo_acc_4", name: "Trader Joe's", merchantName: "Trader Joe's", amount: 93.12, date: prevMonth(18), category: "Food & Dining", tags: [], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
  { id: "dt_26", accountId: "demo_acc_4", name: "Shell Oil", merchantName: "Shell", amount: 72.18, date: prevMonth(7), category: "Transport", tags: [], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
  { id: "dt_27", accountId: "demo_acc_4", name: "Uber", merchantName: "Uber", amount: 31.20, date: prevMonth(14), category: "Transport", tags: [], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
  { id: "dt_28", accountId: "demo_acc_4", name: "Amazon.com", merchantName: "Amazon", amount: 124.99, date: prevMonth(10), category: "Shopping", tags: [], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
  { id: "dt_29", accountId: "demo_acc_4", name: "Netflix.com", merchantName: "Netflix", amount: 22.99, date: prevMonth(8), category: "Entertainment", tags: ["subscription"], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
  { id: "dt_30", accountId: "demo_acc_4", name: "Spotify USA", merchantName: "Spotify", amount: 9.99, date: prevMonth(3), category: "Entertainment", tags: ["subscription"], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
  { id: "dt_31", accountId: "demo_acc_4", name: "Equinox Fitness", merchantName: "Equinox", amount: 49.99, date: prevMonth(12), category: "Health & Fitness", tags: ["subscription"], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
  { id: "dt_32", accountId: "demo_acc_4", name: "SoulCycle", merchantName: "SoulCycle", amount: 35.00, date: prevMonth(22), category: "Health & Fitness", tags: [], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },

  // Two months ago
  { id: "dt_33", accountId: "demo_acc_1", name: "Direct Deposit ACME CORP PAYROLL", merchantName: "ACME Corp", amount: -3600, date: twoMonthsAgo(1), category: "Income", tags: [], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[0] },
  { id: "dt_34", accountId: "demo_acc_1", name: "Direct Deposit ACME CORP PAYROLL", merchantName: "ACME Corp", amount: -3600, date: twoMonthsAgo(15), category: "Income", tags: [], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[0] },
  { id: "dt_35", accountId: "demo_acc_4", name: "Rent Payment", merchantName: "Landlord", amount: 2100, date: twoMonthsAgo(1), category: "Housing", tags: [], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
  { id: "dt_36", accountId: "demo_acc_4", name: "Whole Foods Market", merchantName: "Whole Foods", amount: 198.34, date: twoMonthsAgo(6), category: "Food & Dining", tags: [], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
  { id: "dt_37", accountId: "demo_acc_4", name: "IKEA", merchantName: "IKEA", amount: 347.50, date: twoMonthsAgo(12), category: "Shopping", tags: ["home"], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
  { id: "dt_38", accountId: "demo_acc_4", name: "Delta Air Lines", merchantName: "Delta", amount: 412.00, date: twoMonthsAgo(20), category: "Travel", tags: ["vacation"], reviewed: true, pending: false, splits: [], account: DEMO_ACCOUNTS[3] },
];

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
export const DEMO_DASHBOARD = {
  netWorth: 49713.31,
  totalAssets: 52560.62,
  totalCash: 37740.18,
  totalInvestments: 14820.44,
  totalCreditDebt: 2847.31,
  currentMonthIncome: 7200,
  currentMonthExpenses: 2883.04,
  accounts: DEMO_ACCOUNTS,
  categorySpending: {
    Housing: 2100,
    "Food & Dining": 381.78,
    Transport: 111.67,
    Shopping: 161.50,
    Entertainment: 53.96,
    "Health & Fitness": 49.99,
    "Personal Care": 28.13,
  },
  budgetProgress: [
    { id: "db_1", category: "Housing", emoji: "🏠", monthlyLimit: 2200, spent: 2100, remaining: 100, percentage: 95, rawPercentage: 95, isOver: false },
    { id: "db_2", category: "Food & Dining", emoji: "🍔", monthlyLimit: 400, spent: 381.78, remaining: 18.22, percentage: 95, rawPercentage: 95, isOver: false },
    { id: "db_3", category: "Transport", emoji: "🚗", monthlyLimit: 150, spent: 111.67, remaining: 38.33, percentage: 74, rawPercentage: 74, isOver: false },
    { id: "db_4", category: "Shopping", emoji: "🛍️", monthlyLimit: 200, spent: 161.50, remaining: 38.50, percentage: 81, rawPercentage: 81, isOver: false },
    { id: "db_5", category: "Entertainment", emoji: "🎬", monthlyLimit: 80, spent: 53.96, remaining: 26.04, percentage: 67, rawPercentage: 67, isOver: false },
    { id: "db_6", category: "Health & Fitness", emoji: "💪", monthlyLimit: 60, spent: 49.99, remaining: 10.01, percentage: 83, rawPercentage: 83, isOver: false },
  ],
};

// ─── NET WORTH HISTORY (30 days) ──────────────────────────────────────────────
export const DEMO_NETWORTH_HISTORY = (() => {
  const history = [];
  const targetNW = 49713.31;
  const targetCash = 37740.18;
  const targetInv = 14820.44;
  const targetDebt = 2847.31;

  for (let i = 30; i >= 0; i--) {
    const dt = new Date(now);
    dt.setDate(dt.getDate() - i);
    const label = dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const t = i / 30;
    // Gentle upward trend with slight noise
    const noise = Math.sin(i * 0.7) * 180;
    const cash = Math.round((targetCash * (1 - t * 0.05) + noise) * 100) / 100;
    const inv = Math.round((targetInv * (1 - t * 0.08) + noise * 0.3) * 100) / 100;
    const debt = Math.round((targetDebt * (1 + t * 0.04)) * 100) / 100;
    const nw = i === 0 ? targetNW : Math.round((cash + inv - debt) * 100) / 100;
    history.push({ date: label, NetWorth: nw, Cash: cash, Investments: inv, Debt: debt });
  }
  return history;
})();

// ─── SUBSCRIPTIONS ────────────────────────────────────────────────────────────
const nextMonth = (day: number) => new Date(y, m + 1, day).toISOString();

export const DEMO_SUBSCRIPTIONS = {
  subscriptions: [
    { id: "ds_1", name: "Equinox Fitness", merchantName: "Equinox", amount: 49.99, frequency: "monthly", nextDueDate: nextMonth(12), category: "Health & Fitness", status: "active", logoUrl: null },
    { id: "ds_2", name: "Netflix", merchantName: "Netflix", amount: 22.99, frequency: "monthly", nextDueDate: nextMonth(8), category: "Entertainment", status: "active", logoUrl: null },
    { id: "ds_3", name: "Hulu", merchantName: "Hulu", amount: 17.99, frequency: "monthly", nextDueDate: nextMonth(23), category: "Entertainment", status: "active", logoUrl: null },
    { id: "ds_4", name: "Spotify", merchantName: "Spotify", amount: 9.99, frequency: "monthly", nextDueDate: nextMonth(3), category: "Entertainment", status: "active", logoUrl: null },
    { id: "ds_5", name: "Apple iCloud+", merchantName: "Apple", amount: 2.99, frequency: "monthly", nextDueDate: nextMonth(18), category: "Entertainment", status: "active", logoUrl: null },
  ],
  totalMonthlyCost: 103.95,
};

// ─── INSIGHTS / MOM ────────────────────────────────────────────────────────────
export const DEMO_INSIGHTS = (() => {
  const monthLabels = [];
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(y, m - i, 1);
    monthLabels.push(dt.toLocaleDateString("en-US", { month: "short", year: "2-digit" }));
  }

  const getMonthData = (offset: number) => {
    const dt = new Date(y, m - offset, 1);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    return { key, year: dt.getFullYear(), month: dt.getMonth() };
  };

  const md5 = getMonthData(5);
  const md4 = getMonthData(4);
  const md3 = getMonthData(3);
  const md2 = getMonthData(2);
  const md1 = getMonthData(1);
  const md0 = getMonthData(0);

  const monthlySummary = [
    { key: md5.key, label: monthLabels[0], year: md5.year, month: md5.month, income: 7200, spending: 3820, netSavings: 3380, savingsRate: 47, categories: { Housing: 2100, "Food & Dining": 420, Transport: 130, Shopping: 580, Entertainment: 55, "Health & Fitness": 85, Travel: 450 } },
    { key: md4.key, label: monthLabels[1], year: md4.year, month: md4.month, income: 7200, spending: 3650, netSavings: 3550, savingsRate: 49, categories: { Housing: 2100, "Food & Dining": 395, Transport: 145, Shopping: 348, Entertainment: 53, "Health & Fitness": 85 } },
    { key: md3.key, label: monthLabels[2], year: md3.year, month: md3.month, income: 7200, spending: 3920, netSavings: 3280, savingsRate: 46, categories: { Housing: 2100, "Food & Dining": 466, Transport: 155, Shopping: 760, Entertainment: 50, "Health & Fitness": 85, Travel: 304 } },
    { key: md2.key, label: monthLabels[3], year: md2.year, month: md2.month, income: 7200, spending: 4859, netSavings: 2341, savingsRate: 33, categories: { Housing: 2100, "Food & Dining": 261, Transport: 103, Shopping: 472, Entertainment: 32, "Health & Fitness": 84, Travel: 412 } },
    { key: md1.key, label: monthLabels[4], year: md1.year, month: md1.month, income: 7200, spending: 3485, netSavings: 3715, savingsRate: 52, categories: { Housing: 2100, "Food & Dining": 261, Transport: 103, Shopping: 125, Entertainment: 82, "Health & Fitness": 85 } },
    { key: md0.key, label: monthLabels[5], year: md0.year, month: md0.month, income: 7200, spending: 2883, netSavings: 4317, savingsRate: 60, categories: { Housing: 2100, "Food & Dining": 382, Transport: 112, Shopping: 162, Entertainment: 54, "Health & Fitness": 50, "Personal Care": 28 } },
  ];

  return {
    currentDay: now.getDate(),
    daysInMonth: new Date(y, m + 1, 0).getDate(),
    monthlySummary,
    currentIncome: 7200,
    prevIncome: 7200,
    incomeMoM: 0,
    currentSpending: 2883,
    prevSpending: 3485,
    spendingMoM: -17,
    currentSavings: 4317,
    prevSavings: 3715,
    savingsMoM: 16,
    categoryMoM: [
      { category: "Housing", currentSpent: 2100, prevSpent: 2100, diff: 0, pct: 0 },
      { category: "Food & Dining", currentSpent: 382, prevSpent: 261, diff: 121, pct: 46 },
      { category: "Transport", currentSpent: 112, prevSpent: 103, diff: 9, pct: 9 },
      { category: "Shopping", currentSpent: 162, prevSpent: 125, diff: 37, pct: 30 },
      { category: "Entertainment", currentSpent: 54, prevSpent: 82, diff: -28, pct: -34 },
      { category: "Health & Fitness", currentSpent: 50, prevSpent: 85, diff: -35, pct: -41 },
    ],
  };
})();

// ── Investments (sample sample two-brokerage portfolio) ──────────────────
const demoBrokerage = { name: "Demo Brokerage", mask: "2291", institution: "Demo Brokerage" };
const demoBrokerageIra = { name: "Roth IRA", mask: "7781", institution: "Demo Brokerage" };
const demoInvest = { name: "Demo Invest Individual", mask: "5530", institution: "Demo Invest" };
const demoSec = (ticker: string, name: string, type: string, isCashEquivalent = false) => ({ id: ticker, ticker, name, type, isCashEquivalent });
const demoHolding = (
  account: typeof demoBrokerage,
  security: ReturnType<typeof demoSec>,
  quantity: number,
  price: number,
  costBasis: number | null
) => ({ quantity, costBasis, institutionPrice: price, institutionValue: Math.round(quantity * price * 100) / 100, account, security });

const DEMO_HOLDINGS = [
  demoHolding(demoBrokerage, demoSec("VTI", "Vanguard Total Stock Market ETF", "etf"), 18, 312.4, 4410),
  demoHolding(demoBrokerage, demoSec("AAPL", "Apple Inc.", "equity"), 12, 228.6, 1980),
  demoHolding(demoBrokerage, demoSec("MMKT", "Government Money Market Fund", "mutual fund", true), 640, 1, 640),
  demoHolding(demoBrokerageIra, demoSec("SP500", "S&P 500 Index Fund", "mutual fund"), 9.5, 214.3, 1690),
  demoHolding(demoInvest, demoSec("AAPL", "Apple Inc.", "equity"), 6, 228.6, 1260),
  demoHolding(demoInvest, demoSec("NVDA", "NVIDIA Corporation", "equity"), 15, 132.8, 1425),
  demoHolding(demoInvest, demoSec("MSFT", "Microsoft Corporation", "equity"), 3, 441.2, 1185),
  demoHolding(demoInvest, demoSec("TSLA", "Tesla, Inc.", "equity"), 2, 251.5, 610),
  demoHolding(demoInvest, demoSec("BTC", "Bitcoin", "cryptocurrency"), 0.012, 64200, 640),
];

export const DEMO_INVESTMENTS = (() => {
  const portfolio = buildPortfolio(DEMO_HOLDINGS);
  const history = [];
  for (let i = 30; i >= 0; i--) {
    const dt = new Date(now);
    dt.setDate(dt.getDate() - i);
    const drift = 1 - (i / 30) * 0.05 + Math.sin(i / 3) * 0.006;
    history.push({
      date: dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: Math.round(portfolio.totalValue * drift * 100) / 100,
    });
  }
  const act = (daysAgo: number, name: string, type: string, subtype: string, ticker: string | null, quantity: number, price: number, institution: string) => ({
    id: `di_${daysAgo}_${name}`,
    date: d(daysAgo).split("T")[0],
    name,
    type,
    subtype,
    ticker,
    quantity,
    price,
    amount: Math.round(quantity * price * 100) / 100 * (type === "sell" || subtype === "dividend" ? -1 : 1),
    institution,
  });
  return {
    ...portfolio,
    history,
    activity: [
      act(2, "Buy NVDA", "buy", "buy", "NVDA", 5, 128.4, "Demo Invest"),
      act(5, "Dividend VTI", "cash", "dividend", "VTI", 1, 14.22, "Demo Brokerage"),
      act(9, "Buy VTI", "buy", "buy", "VTI", 2, 305.1, "Demo Brokerage"),
      act(14, "Sell TSLA", "sell", "sell", "TSLA", 1, 262.0, "Demo Invest"),
      act(21, "Dividend AAPL", "cash", "dividend", "AAPL", 1, 4.5, "Demo Brokerage"),
      act(27, "Contribution", "cash", "contribution", null, 1, 500, "Demo Brokerage"),
    ],
    needsConsent: [] as { bankItemId: string; institution: string }[],
  };
})();
