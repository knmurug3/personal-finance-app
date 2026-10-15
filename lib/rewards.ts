interface AccountInfo {
  id: string;
  name: string;
  officialName?: string | null;
  mask?: string | null;
  type: string;
}

export interface CategoryRewardRecommendation {
  category: string;
  emoji: string;
  bestCardName: string;
  multiplier: string;
  reason: string;
}

export function analyzeCreditCardRewards(accounts: AccountInfo[]) {
  const creditCards = accounts.filter(
    (a) => a.type === "credit" || a.name.toLowerCase().includes("gold") || a.name.toLowerCase().includes("card") || a.name.toLowerCase().includes("sapphire")
  );

  // Without a credit card there is nothing to recommend — don't invent one
  if (creditCards.length === 0) {
    return { creditCardsCount: 0, recommendations: [] as CategoryRewardRecommendation[] };
  }

  const cardNames = creditCards.map((c) => `${c.officialName ?? ""} ${c.name}`.toLowerCase());

  const hasAmexGold = cardNames.some((n) => n.includes("gold"));
  const hasBlueCash = cardNames.some((n) => n.includes("blue cash") || n.includes("everyday"));
  // Only cards we can identify get a bonus; Reserve (3x) and Preferred (2x) differ
  const hasSapphireReserve = cardNames.some((n) => n.includes("sapphire") && n.includes("reserve"));
  const hasSapphirePreferred = cardNames.some((n) => n.includes("sapphire") && n.includes("preferred"));
  const hasFreedom = cardNames.some((n) => n.includes("freedom"));

  const recommendations: CategoryRewardRecommendation[] = [
    {
      category: "Food & Dining (Groceries & Restaurants)",
      emoji: "🍔",
      bestCardName: hasAmexGold
        ? "American Express Gold Card"
        : hasBlueCash
        ? "Blue Cash Everyday®"
        : creditCards[0].name,
      multiplier: hasAmexGold ? "4x Points" : hasBlueCash ? "3% Cash Back" : "Base rate",
      reason: hasAmexGold
        ? "Earns 4x Membership Rewards points at U.S. Supermarkets & Restaurants."
        : hasBlueCash
        ? "Earns 3% cash back at U.S. supermarkets."
        : "None of your cards has a known dining bonus — this is your default card.",
    },
    {
      category: "Streaming Services (Disney+, Netflix, Spotify)",
      emoji: "🎬",
      bestCardName: hasBlueCash
        ? "Blue Cash Everyday®"
        : hasAmexGold
        ? "American Express Gold Card"
        : creditCards[0].name,
      multiplier: hasBlueCash ? "3% Cash Back" : "Base rate",
      reason: hasBlueCash
        ? "Earns 3% cash back on U.S. online retail & streaming subscriptions."
        : "No streaming bonus detected on your cards.",
    },
    {
      category: "Transport & Gas Stations",
      emoji: "🚗",
      bestCardName: hasBlueCash
        ? "Blue Cash Everyday®"
        : hasSapphireReserve
        ? "Chase Sapphire Reserve®"
        : hasSapphirePreferred
        ? "Chase Sapphire Preferred®"
        : creditCards[0].name,
      multiplier: hasBlueCash ? "3% Cash Back" : hasSapphireReserve ? "3x Points" : hasSapphirePreferred ? "2x Points" : "Base rate",
      reason: hasBlueCash
        ? "Earns 3% cash back at U.S. gas stations."
        : hasSapphireReserve
        ? "Earns 3x points on travel & transit."
        : hasSapphirePreferred
        ? "Earns 2x points on travel."
        : "No travel or gas bonus detected on your cards.",
    },
    {
      category: "Shopping & Retail",
      emoji: "🛍️",
      bestCardName: hasBlueCash
        ? "Blue Cash Everyday®"
        : hasFreedom
        ? "Chase Freedom Unlimited®"
        : creditCards[0].name,
      multiplier: hasBlueCash ? "3% Cash Back" : hasFreedom ? "1.5% Cash Back" : "Base rate",
      reason: hasBlueCash
        ? "Earns 3% cash back on U.S. online retail purchases."
        : hasFreedom
        ? "Earns 1.5% cash back on every purchase."
        : "No shopping bonus detected on your cards.",
    },
  ];

  return {
    creditCardsCount: creditCards.length,
    recommendations,
  };
}
