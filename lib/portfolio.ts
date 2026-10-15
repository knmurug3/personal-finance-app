import { roundMoney } from "@/lib/money";

export interface HoldingInput {
  quantity: number;
  costBasis: number | null;
  institutionPrice: number;
  institutionValue: number;
  account: { name: string; mask?: string | null; institution: string };
  security: { id: string; ticker: string | null; name: string | null; type: string | null; isCashEquivalent: boolean };
}

export interface PositionAccount {
  account: string;
  institution: string;
  quantity: number;
  value: number;
  costBasis: number | null;
}

export interface Position {
  key: string;
  ticker: string | null;
  name: string;
  type: string;
  quantity: number;
  price: number;
  value: number;
  /** Null when any lot is missing cost basis (gain would be misleading) */
  costBasis: number | null;
  gain: number | null;
  gainPct: number | null;
  weight: number;
  accounts: PositionAccount[];
}

/** An investment account whose balance is known but whose holdings weren't shared */
export interface UnitemizedAccount {
  bankItemId?: string;
  institution: string;
  account: string;
  value: number;
  /** The institution is still preparing holdings (just after sharing changed) */
  pending?: boolean;
}

export interface AllocationSlice {
  type: string;
  label: string;
  value: number;
  weight: number;
}

export interface Portfolio {
  totalValue: number;
  /** Cost of positions that report cost basis */
  totalCost: number;
  totalGain: number;
  totalGainPct: number;
  positions: Position[];
  allocation: AllocationSlice[];
  /** Single stocks above CONCENTRATION_LIMIT of the portfolio */
  concentrated: { ticker: string | null; name: string; weight: number }[];
  institutions: { institution: string; value: number }[];
  /** Included in totalValue, allocation and institutions, but not in positions or returns */
  unitemized: UnitemizedAccount[];
}

export const CONCENTRATION_LIMIT = 0.2;

const TYPE_LABELS: Record<string, string> = {
  equity: "Stocks",
  etf: "ETFs",
  "mutual fund": "Mutual Funds",
  "fixed income": "Bonds",
  cash: "Cash",
  cryptocurrency: "Crypto",
  derivative: "Options",
  loan: "Loans",
  other: "Other",
  unitemized: "Not itemized",
};

// Plaid flags some crypto (even BTC) as cash-equivalent; only real cash and money-market sweeps count as cash
const normalizeType = (h: HoldingInput["security"]) => {
  const type = (h.type || "other").toLowerCase();
  if (type === "cash") return "cash";
  if (h.isCashEquivalent && type !== "cryptocurrency" && type !== "equity" && type !== "etf") return "cash";
  return type;
};

/** Rolls holdings from every brokerage account up into one position per stock. */
export function buildPortfolio(holdings: HoldingInput[], unitemized: UnitemizedAccount[] = []): Portfolio {
  const byKey = new Map<string, { pos: Omit<Position, "weight" | "gain" | "gainPct">; missingCost: boolean }>();

  for (const h of holdings) {
    const type = normalizeType(h.security);
    // Cash sweeps from every account collapse into one "Cash" line
    const key = type === "cash" ? "CASH" : (h.security.ticker || h.security.name || h.security.id).toUpperCase();
    const entry =
      byKey.get(key) ||
      {
        pos: {
          key,
          ticker: type === "cash" ? null : h.security.ticker,
          name: type === "cash" ? "Cash" : h.security.name || h.security.ticker || "Unknown security",
          type,
          quantity: 0,
          price: h.institutionPrice,
          value: 0,
          costBasis: 0,
          accounts: [],
        },
        missingCost: false,
      };

    entry.pos.quantity += h.quantity;
    entry.pos.value += h.institutionValue;
    entry.pos.price = h.institutionPrice;
    if (h.costBasis === null || h.costBasis === undefined) entry.missingCost = true;
    else entry.pos.costBasis = (entry.pos.costBasis ?? 0) + h.costBasis;
    entry.pos.accounts.push({
      account: h.account.mask ? `${h.account.name} ••${h.account.mask}` : h.account.name,
      institution: h.account.institution,
      quantity: h.quantity,
      value: roundMoney(h.institutionValue),
      costBasis: h.costBasis === null || h.costBasis === undefined ? null : roundMoney(h.costBasis),
    });
    byKey.set(key, entry);
  }

  const unitemizedValue = unitemized.reduce((s, a) => s + a.value, 0);
  const totalValue = roundMoney([...byKey.values()].reduce((s, e) => s + e.pos.value, 0) + unitemizedValue);

  const positions: Position[] = [...byKey.values()]
    .map(({ pos, missingCost }) => {
      const value = roundMoney(pos.value);
      const costBasis = missingCost || pos.type === "cash" ? null : roundMoney(pos.costBasis ?? 0);
      const gain = costBasis === null ? null : roundMoney(value - costBasis);
      return {
        ...pos,
        value,
        costBasis,
        gain,
        gainPct: gain === null || !costBasis ? null : gain / costBasis,
        weight: totalValue > 0 ? value / totalValue : 0,
        accounts: pos.accounts.sort((a, b) => b.value - a.value),
      };
    })
    .sort((a, b) => b.value - a.value);

  const withCost = positions.filter((p) => p.costBasis !== null);
  const totalCost = roundMoney(withCost.reduce((s, p) => s + (p.costBasis ?? 0), 0));
  const totalGain = roundMoney(withCost.reduce((s, p) => s + (p.gain ?? 0), 0));

  const allocMap = new Map<string, number>();
  for (const p of positions) allocMap.set(p.type, (allocMap.get(p.type) || 0) + p.value);
  if (unitemizedValue > 0) allocMap.set("unitemized", unitemizedValue);
  const allocation = [...allocMap.entries()]
    .map(([type, value]) => ({
      type,
      label: TYPE_LABELS[type] || type.replace(/\b\w/g, (c) => c.toUpperCase()),
      value: roundMoney(value),
      weight: totalValue > 0 ? value / totalValue : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const instMap = new Map<string, number>();
  for (const p of positions) for (const a of p.accounts) instMap.set(a.institution, (instMap.get(a.institution) || 0) + a.value);
  for (const a of unitemized) instMap.set(a.institution, (instMap.get(a.institution) || 0) + a.value);

  return {
    totalValue,
    totalCost,
    totalGain,
    totalGainPct: totalCost > 0 ? totalGain / totalCost : 0,
    positions,
    allocation,
    concentrated: positions
      .filter((p) => p.type === "equity" && p.weight > CONCENTRATION_LIMIT)
      .map((p) => ({ ticker: p.ticker, name: p.name, weight: p.weight })),
    institutions: [...instMap.entries()]
      .map(([institution, value]) => ({ institution, value: roundMoney(value) }))
      .sort((a, b) => b.value - a.value),
    unitemized: unitemized.map((a) => ({ ...a, value: roundMoney(a.value) })).sort((a, b) => b.value - a.value),
  };
}
