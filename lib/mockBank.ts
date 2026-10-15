import { db } from "./db";

export async function seedMockBankData() {
  // Check if mock bank item already exists
  const existingMockItem = await db.bankItem.findFirst({
    where: { itemId: "mock_bank_chase_demo" },
  });

  if (existingMockItem) {
    return existingMockItem;
  }

  // Create Mock Bank Item (Demo)
  const bankItem = await db.bankItem.create({
    data: {
      itemId: "mock_bank_chase_demo",
      accessToken: "mock_access_token_chase_12345",
      institutionName: "Demo Bank",
      status: "active",
    },
  });

  // Create Mock Accounts
  const checking = await db.account.create({
    data: {
      bankItemId: bankItem.id,
      plaidAccountId: "mock_acc_checking_001",
      name: "Total Checking",
      officialName: "Everyday Checking",
      type: "depository",
      subtype: "checking",
      mask: "4821",
      currentBalance: 5420.75,
      availableBalance: 5420.75,
      isoCurrencyCode: "USD",
    },
  });

  const savings = await db.account.create({
    data: {
      bankItemId: bankItem.id,
      plaidAccountId: "mock_acc_savings_002",
      name: "High Yield Savings",
      officialName: "High Yield Savings",
      type: "depository",
      subtype: "savings",
      mask: "9102",
      currentBalance: 24500.00,
      availableBalance: 24500.00,
      isoCurrencyCode: "USD",
    },
  });

  const creditCard = await db.account.create({
    data: {
      bankItemId: bankItem.id,
      plaidAccountId: "mock_acc_credit_003",
      name: "Rewards Card",
      officialName: "Rewards Credit Card",
      type: "credit",
      subtype: "credit card",
      mask: "6543",
      currentBalance: 1420.50,
      availableBalance: 8579.50,
      isoCurrencyCode: "USD",
    },
  });

  const investment = await db.account.create({
    data: {
      bankItemId: bankItem.id,
      plaidAccountId: "mock_acc_invest_004",
      name: "Individual Brokerage",
      officialName: "J.P. Morgan Self-Directed Investing",
      type: "investment",
      subtype: "brokerage",
      mask: "3310",
      currentBalance: 42100.00,
      availableBalance: 42100.00,
      isoCurrencyCode: "USD",
    },
  });

  // Copilot Category Budgets with Emojis
  const defaultBudgets = [
    { category: "Housing", emoji: "🏠", monthlyLimit: 2000.00 },
    { category: "Food & Dining", emoji: "🍔", monthlyLimit: 600.00 },
    { category: "Transport", emoji: "🚗", monthlyLimit: 250.00 },
    { category: "Shopping", emoji: "🛍️", monthlyLimit: 300.00 },
    { category: "Entertainment", emoji: "🎬", monthlyLimit: 150.00 },
    { category: "Utilities", emoji: "⚡", monthlyLimit: 200.00 },
    { category: "Investments", emoji: "📈", monthlyLimit: 1000.00 },
  ];

  for (const budget of defaultBudgets) {
    await db.budget.upsert({
      where: { category: budget.category },
      update: { emoji: budget.emoji },
      create: budget,
    });
  }

  return bankItem;
}
