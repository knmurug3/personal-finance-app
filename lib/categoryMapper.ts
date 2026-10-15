export function mapPlaidCategoryToStandard(
  rawCategory: string,
  txName: string = ""
): string {
  if (!rawCategory && !txName) return "General";
  const name = txName.toLowerCase().trim();
  const c = (rawCategory || "").trim();
  const lower = c.toLowerCase();

  // 1. High-Priority Merchant Name Matching Rules (PERMANENT GUARDS)
  if (
    name.includes("dividend") ||
    name.includes("interest earned") ||
    name.includes("yield")
  ) {
    return "Income";
  }

  if (
    name.includes("you sold") ||
    name.includes("you bought") ||
    name.includes("purchase into core") ||
    name.includes("redemption from core") ||
    name.includes("reinvestment") ||
    name.includes("tax withheld")
  ) {
    return "Transfers";
  }

  if (
    name.includes("rent") ||
    name.includes("mortgage") ||
    name.includes("apartment") ||
    name.includes("housing") ||
    name.includes("property management")
  ) {
    return "Housing";
  }

  if (
    name.includes("trader joe") ||
    name.includes("whole foods") ||
    name.includes("aldi") ||
    name.includes("kroger") ||
    name.includes("safeway") ||
    name.includes("publix") ||
    name.includes("supermarket") ||
    (name.includes("costco") && !name.includes("gas"))
  ) {
    return "Grocery";
  }

  if (
    name.includes("gas") ||
    name.includes("car wash") ||
    name.includes("napa") ||
    name.includes("shell") ||
    name.includes("chevron") ||
    name.includes("exxon") ||
    name.includes("bp ") ||
    name.includes("uber") ||
    name.includes("lyft")
  ) {
    return "Transport";
  }

  if (
    name.includes("cine") ||
    name.includes("theater") ||
    name.includes("cinema") ||
    name.includes("bowling") ||
    name.includes("disney") ||
    name.includes("netflix") ||
    name.includes("hulu") ||
    name.includes("spotify")
  ) {
    return "Entertainment";
  }

  if (
    name.includes("anthropic") ||
    name.includes("claude") ||
    name.includes("openai") ||
    name.includes("chatgpt") ||
    name.includes("github") ||
    name.includes("aws") ||
    name.includes("google cloud")
  ) {
    return "Utilities";
  }

  if (
    name.includes("ross") ||
    name.includes("tj maxx") ||
    name.includes("marshalls") ||
    name.includes("nordstrom") ||
    name.includes("macys") ||
    name.includes("amazon") ||
    name.includes("target") ||
    name.includes("walmart")
  ) {
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
    lower.includes("rent") ||
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
