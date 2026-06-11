import { fuzzy } from "fast-fuzzy";
import type {
  CanonicalItem,
  MatchResult,
  ScoredCandidate,
} from "@/types/canonical";
import { computeSavings } from "./savings";

/**
 * Matches one Ocado item against Amazon search candidates.
 *
 * Confidence = weighted blend of:
 *  - fuzzy title similarity (size/noise words stripped)
 *  - brand agreement
 *  - size compatibility (same base unit, similar magnitude)
 *
 * Candidates below MIN_CONFIDENCE are kept in `candidates` (for "fix match")
 * but never auto-selected as bestMatch.
 */

export const MIN_CONFIDENCE = 0.55;

const NOISE_WORDS = new Set([
  "the", "a", "of", "with", "in", "and", "&", "new", "pack", "x",
  "amazon", "ocado", "uk", "free", "delivery",
]);

/** Strip sizes, punctuation and noise words; sort tokens for order-free compare. */
export function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    // remove measure tokens: 415g, 1.5kg, 6x330ml, 75cl, 12pk...
    .replace(/\d+(?:[.,]\d+)?\s*(?:kg|g|mg|ml|cl|l|ltr|litre[s]?|pint[s]?|pk|pack)\b/g, " ")
    .replace(/\d+\s*[x×]\s*/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t && !NOISE_WORDS.has(t) && !/^\d+$/.test(t))
    .sort()
    .join(" ");
}

function titleScore(a: string, b: string): number {
  const na = normaliseTitle(a);
  const nb = normaliseTitle(b);
  if (!na || !nb) return 0;
  // fast-fuzzy is asymmetric; take the better direction.
  return Math.max(fuzzy(na, nb), fuzzy(nb, na));
}

function brandScore(ocado: CanonicalItem, amazon: CanonicalItem): number {
  const brand = (ocado.brand ?? "").toLowerCase().trim();
  if (!brand) return 0.5; // unknown brand: neutral
  const haystack = `${amazon.brand ?? ""} ${amazon.title}`.toLowerCase();
  return haystack.includes(brand) ? 1 : 0;
}

function sizeScore(ocado: CanonicalItem, amazon: CanonicalItem): number {
  if (!ocado.size || !amazon.size) return 0.5; // unknown: neutral
  if (ocado.size.unit !== amazon.size.unit) return 0; // g vs ml: likely different form
  const a = ocado.size.count * ocado.size.amount;
  const b = amazon.size.count * amazon.size.amount;
  if (a <= 0 || b <= 0) return 0.5;
  // Same unit with a different total is usually just a multipack/bulk size —
  // unit-price comparison handles that fairly — so only nudge confidence.
  const ratio = Math.min(a, b) / Math.max(a, b);
  return ratio >= 0.5 ? 1 : 0.75;
}

export function scoreCandidate(
  ocado: CanonicalItem,
  amazon: CanonicalItem,
): number {
  const score =
    0.7 * titleScore(ocado.title, amazon.title) +
    0.15 * brandScore(ocado, amazon) +
    0.15 * sizeScore(ocado, amazon);
  return Math.min(1, Math.max(0, score));
}

/**
 * Rank Amazon candidates for an Ocado item. Only Prime-eligible candidates
 * are considered (user is a Prime member; non-Prime prices are not comparable).
 */
export function matchItem(
  ocado: CanonicalItem,
  amazonCandidates: CanonicalItem[],
  opts: { minConfidence?: number; confirmedAsin?: string } = {},
): MatchResult {
  const minConfidence = opts.minConfidence ?? MIN_CONFIDENCE;

  const scored: ScoredCandidate[] = amazonCandidates
    .filter((c) => c.primeEligible !== false)
    .map((item) => ({
      item,
      confidence: scoreCandidate(ocado, item),
      savings: computeSavings(ocado, item),
    }))
    .sort((a, b) => b.confidence - a.confidence);

  // A user-confirmed mapping always wins.
  const confirmed = opts.confirmedAsin
    ? scored.find((c) => c.item.id === opts.confirmedAsin)
    : undefined;

  // Among candidates within a whisker of the top confidence (e.g. the same
  // product in different pack sizes), prefer the one with the best savings.
  let auto: ScoredCandidate | undefined;
  if (scored.length > 0 && scored[0].confidence >= minConfidence) {
    const nearTop = scored.filter(
      (c) => scored[0].confidence - c.confidence <= 0.05,
    );
    auto = nearTop.reduce((best, c) =>
      c.savings.savingsPence > best.savings.savingsPence ? c : best,
    );
  }

  const bestMatch = confirmed ?? auto;

  return {
    ocadoItem: ocado,
    bestMatch,
    candidates: scored.slice(0, 8),
    fromConfirmedMapping: Boolean(confirmed),
  };
}
