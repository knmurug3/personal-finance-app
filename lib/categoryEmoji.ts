const DEFAULT_CATEGORY_EMOJIS: Record<string, string> = {
  Grocery: "🛒",
  "Food & Dining": "🍔",
  Housing: "🏠",
  Transport: "🚗",
  Shopping: "🛍️",
  Entertainment: "🎬",
  Utilities: "⚡",
  Investments: "📈",
  Income: "💵",
  Transfers: "🔄",
  "Health & Fitness": "💪",
  "Personal Care": "🧴",
  Travel: "✈️",
  General: "📦",
};

/** Emoji for a category: the budget's own emoji when it has one, else a default. */
export function getCategoryEmoji(categoryName: string, budgetEmojiMap?: Record<string, string>): string {
  return budgetEmojiMap?.[categoryName] || DEFAULT_CATEGORY_EMOJIS[categoryName] || "📦";
}

export const STANDARD_CATEGORIES = Object.keys(DEFAULT_CATEGORY_EMOJIS);
