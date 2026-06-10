/**
 * Shared types used across providers, the matching engine and the UI.
 * All monetary values are integer pence to avoid floating-point drift.
 */

export type Source = "ocado" | "amazon";

/** Base units everything is normalised to. */
export type BaseUnit = "g" | "ml" | "each";

/** A parsed pack size, e.g. "6 x 330ml" -> { count: 6, amount: 330, unit: "ml" }. */
export interface ParsedSize {
  /** Number of items in a multipack (1 for a single pack). */
  count: number;
  /** Size of a single item in `unit`. */
  amount: number;
  unit: BaseUnit;
}

/** Total normalised content of a pack (count * amount). */
export function totalAmount(size: ParsedSize): number {
  return size.count * size.amount;
}

/** A product line normalised from any source. */
export interface CanonicalItem {
  source: Source;
  /** Ocado SKU or Amazon ASIN. */
  id: string;
  title: string;
  brand?: string;
  /** Parsed size, when it could be extracted. */
  size?: ParsedSize;
  /** Basket quantity (Ocado) — 1 for search candidates. */
  quantity: number;
  /** Price for ONE pack, in pence. */
  pricePence: number;
  /** Pence per 100g / 100ml / each, when size is known. */
  unitPricePence?: number;
  url: string;
  image?: string;
  /** Amazon only: whether the offer is Prime-eligible. */
  primeEligible?: boolean;
}

/** Result of matching one Ocado item against Amazon candidates. */
export interface MatchResult {
  ocadoItem: CanonicalItem;
  /** Best Amazon candidate, if any cleared the confidence threshold. */
  bestMatch?: ScoredCandidate;
  /** Other candidates so the user can "fix match". */
  candidates: ScoredCandidate[];
  /** True if bestMatch came from a user-confirmed SKU<->ASIN mapping. */
  fromConfirmedMapping: boolean;
}

export interface ScoredCandidate {
  item: CanonicalItem;
  /** 0..1 — combined title/brand/size confidence. */
  confidence: number;
  savings: SavingsResult;
}

export interface SavingsResult {
  /**
   * How the comparison was made:
   * - "unit": compared via price per base unit (sizes known on both sides)
   * - "pack": compared pack price directly (sizes unknown or identical)
   */
  basis: "unit" | "pack";
  /**
   * Pence saved by buying the Ocado line's worth of product on Amazon.
   * Negative when Amazon is more expensive.
   */
  savingsPence: number;
  /** Savings as a fraction of the Ocado cost (0.10 = 10% cheaper on Amazon). */
  savingsFraction: number;
  /** Ocado pence per 100g/100ml/each, when computable. */
  ocadoUnitPricePence?: number;
  /** Amazon pence per 100g/100ml/each, when computable. */
  amazonUnitPricePence?: number;
}

/** A full basket comparison. */
export interface ComparisonReport {
  items: MatchResult[];
  /** Sum of positive savings across matched items, in pence. */
  totalPotentialSavingsPence: number;
  generatedAt: string;
}
