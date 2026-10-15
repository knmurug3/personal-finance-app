import { db } from "./db";

export async function getCategoryForMerchant(
  merchantName: string | null | undefined,
  rawName: string,
  defaultCategory: string
): Promise<string> {
  const searchTerm = (merchantName || rawName).toLowerCase().trim();
  if (!searchTerm) return defaultCategory || "General";

  // Check saved custom user rules
  const rules = await db.categoryRule.findMany();
  for (const rule of rules) {
    const pattern = rule.merchantPattern.toLowerCase().trim();
    if (pattern.length >= 3 && searchTerm.includes(pattern)) {
      return rule.category;
    }
  }

  // Fallback to default Plaid/provided category
  return defaultCategory || "General";
}

/**
 * Saves a merchant → category rule and applies it to every existing transaction
 * whose merchant (or name, when there is no merchant) contains the pattern.
 * Returns the rule and how many transactions were recategorized.
 */
export async function saveMerchantCategoryRule(merchantPattern: string, category: string) {
  const cleanPattern = merchantPattern.toLowerCase().trim();
  if (!cleanPattern || cleanPattern.length < 3) return null;

  const rule = await db.categoryRule.upsert({
    where: { merchantPattern: cleanPattern },
    update: { category },
    create: { merchantPattern: cleanPattern, category },
  });

  const { count } = await db.transaction.updateMany({
    where: {
      OR: [
        { merchantName: { contains: cleanPattern, mode: "insensitive" } },
        { merchantName: null, name: { contains: cleanPattern, mode: "insensitive" } },
      ],
    },
    data: { category },
  });

  return { rule, updated: count };
}
