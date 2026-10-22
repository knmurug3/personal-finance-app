export function mapPlaidCategoryToStandard(
  rawCategory: string,
  txName: string = ""
): string {
  if (!rawCategory && !txName) return "General";
  const name = txName.toLowerCase().trim();
  const c = (rawCategory || "").trim();
  const lower = c.toLowerCase();

  // 1. High-Priority Merchant Name Matching Rules (PERMANENT GUARDS)
  // Matched at word boundaries: plain substrings caught Parent/Current as rent, medicine as
  // cinema, Las Vegas as gas, Crossfit as Ross and Paws as AWS.
  if (/\bdividend|\binterest earned|\byield\b/.test(name)) {
    return "Income";
  }

  if (/you sold|you bought|purchase into core|redemption from core|\breinvest|tax withheld/.test(name)) {
    return "Transfers";
  }

  if (/\brent\b(?!\s*a\s*car)|\bmortgage|\bapartment|\bhousing\b|property management/.test(name)) {
    return "Housing";
  }

  if (
    /trader joe|whole foods|\baldi\b|\bkroger\b|\bsafeway\b|\bpublix\b|supermarket/.test(name) ||
    (/\bcostco\b/.test(name) && !/\bgas\b/.test(name))
  ) {
    return "Grocery";
  }

  if (/\bgas(oline)?\b|car wash|\bnapa\b|\bshell\b|\bchevron\b|\bexxon|\bbp\b|\buber\b(?!\s*eats)|\blyft\b/.test(name)) {
    return "Transport";
  }

  if (/\bcine|\btheat(er|re)\b|\bbowling\b|\bdisney|\bnetflix|\bhulu\b|\bspotify/.test(name)) {
    return "Entertainment";
  }

  if (/\banthropic|\bclaude\b|\bopenai|\bchatgpt|\bgithub|\baws\b|google cloud/.test(name)) {
    return "Utilities";
  }

  if (/\bross\b|\btj ?maxx|\bmarshalls|\bnordstrom|\bmacy'?s\b|\bamazon|\btarget\b|\bwalmart/.test(name)) {
    return "Shopping";
  }

  // 2. Preserve explicitly chosen standard categories
  const preserveList = [
    "grocery",
    "food & dining",
    "shopping",
    "entertainment",
    "housing",
    "transport",
    "utilities",
    "transfers",
    "investments",
    "income",
    "general",
  ];

  if (preserveList.includes(lower)) {
    if (lower === "grocery") return "Grocery";
    return c;
  }

  // 3. Internal Bank & Investment Transfers
  if (
    name.includes("transfer") ||
    name.includes("zelle") ||
    name.includes("ach transfer") ||
    name.includes("wire transfer") ||
    name.includes("brokerage") ||
    name.includes("internal transfer") ||
    lower.includes("transfer") ||
    lower.includes("invest") ||
    lower.includes("stock") ||
    lower.includes("trade")
  ) {
    return "Transfers";
  }

  // 4. Plaid Raw String Category Mappings
  if (lower.includes("grocery") || lower.includes("supermarket")) {
    return "Grocery";
  }

  if (
    lower.includes("food") ||
    lower.includes("dining") ||
    lower.includes("restaurant") ||
    lower.includes("coffee") ||
    lower.includes("bakery")
  ) {
    return "Food & Dining";
  }

  if (
    lower.includes("shop") ||
    lower.includes("merchandise") ||
    lower.includes("retail") ||
    lower.includes("store")
  ) {
    return "Shopping";
  }

  if (
    lower.includes("recreation") ||
    lower.includes("entertain") ||
    lower.includes("movie") ||
    lower.includes("streaming") ||
    lower.includes("media")
  ) {
    return "Entertainment";
  }

  if (
    lower.includes("travel") ||
    lower.includes("transport") ||
    lower.includes("taxi") ||
    lower.includes("uber") ||
    lower.includes("gas") ||
    lower.includes("auto") ||
    lower.includes("vehicle")
  ) {
    return "Transport";
  }

  if (
    lower.includes("utilit") ||
    lower.includes("electric") ||
    lower.includes("water") ||
    lower.includes("internet") ||
    lower.includes("sanitation") ||
    lower.includes("sewer") ||
    lower.includes("trash") ||
    lower.includes("heating") ||
    lower.includes("power") ||
    lower.includes("telecom") ||
    lower.includes("bill")
  ) {
    return "Utilities";
  }

  if (
    lower.includes("house") ||
    lower.includes("housing") ||
    /\brent\b/.test(lower) ||
    lower.includes("mortgage") ||
    lower.includes("property")
  ) {
    return "Housing";
  }

  if (
    lower.includes("invest") ||
    lower.includes("stock") ||
    lower.includes("brokerage") ||
    lower.includes("trade")
  ) {
    return "Transfers";
  }

  if (
    name.includes("payroll") ||
    name.includes("salary") ||
    name.includes("direct deposit") ||
    lower.includes("payroll") ||
    lower.includes("salary")
  ) {
    return "Income";
  }

  return "General";
}

/**
 * App category for Plaid's personal_finance_category (the current taxonomy; the legacy
 * `category` array is deprecated). Null when it doesn't map cleanly, so the caller falls
 * back to the legacy category. https://plaid.com/documents/transactions-personal-finance-category-taxonomy.csv
 */
export function mapPersonalFinanceCategory(pfc: { primary?: string; detailed?: string } | null | undefined): string | null {
  const primary = pfc?.primary || "";
  const detailed = pfc?.detailed || "";
  switch (primary) {
    case "INCOME":
      return "Income";
    case "TRANSFER_IN":
    case "TRANSFER_OUT":
      return "Transfers";
    case "LOAN_PAYMENTS":
      // Paying a credit card moves money between the owner's accounts; the card's purchases are the spending
      if (detailed === "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT") return "Transfers";
      if (detailed === "LOAN_PAYMENTS_MORTGAGE_PAYMENT") return "Housing";
      if (detailed === "LOAN_PAYMENTS_CAR_PAYMENT") return "Transport";
      return null;
    case "FOOD_AND_DRINK":
      return detailed === "FOOD_AND_DRINK_GROCERIES" ? "Grocery" : "Food & Dining";
    case "GENERAL_MERCHANDISE":
      return "Shopping";
    case "ENTERTAINMENT":
      return "Entertainment";
    case "TRANSPORTATION":
    case "TRAVEL":
      return "Transport";
    case "RENT_AND_UTILITIES":
      return detailed === "RENT_AND_UTILITIES_RENT" ? "Housing" : "Utilities";
    default:
      return null;
  }
}
