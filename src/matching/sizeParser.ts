import type { BaseUnit, ParsedSize } from "@/types/canonical";

/**
 * Extracts a pack size from a product title or size string and normalises it
 * to base units (g / ml / each).
 *
 * Handles e.g.: "415g", "1.5kg", "750ml", "1L", "33cl", "6 x 330ml",
 * "2x110g", "12 pack", "80 Tea Bags", "4 Pint", "40 washes".
 */

interface UnitDef {
  unit: BaseUnit;
  factor: number;
}

// Longest aliases first so e.g. "ml" wins over "l".
const UNIT_DEFS: [RegExp, UnitDef][] = [
  [/^(?:kg|kilo|kilogram[s]?)$/i, { unit: "g", factor: 1000 }],
  [/^(?:g|gr|gram[s]?)$/i, { unit: "g", factor: 1 }],
  [/^(?:mg)$/i, { unit: "g", factor: 0.001 }],
  [/^(?:ml|milliliter[s]?|millilitre[s]?)$/i, { unit: "ml", factor: 1 }],
  [/^(?:cl)$/i, { unit: "ml", factor: 10 }],
  [/^(?:l|ltr|liter[s]?|litre[s]?)$/i, { unit: "ml", factor: 1000 }],
  [/^(?:pint[s]?|pt)$/i, { unit: "ml", factor: 568 }],
  [/^(?:fl\s?oz)$/i, { unit: "ml", factor: 28.4 }],
  [/^(?:oz)$/i, { unit: "g", factor: 28.35 }],
  [/^(?:lb[s]?)$/i, { unit: "g", factor: 453.6 }],
];

// "each"-like count words: tablets, bags, washes, sheets, capsules, pods...
const COUNT_WORDS =
  /^(?:pack|pk|pcs?|pieces?|tea\s?bags?|bags?|tablets?|capsules?|caps|pods?|washes|sheets?|rolls?|sachets?|portions?|slices?|each|items?|count|ct|wipes|nappies|cans?|bottles?|eggs?)$/i;

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;

function resolveUnit(raw: string): UnitDef | null {
  const cleaned = raw.trim();
  for (const [re, def] of UNIT_DEFS) {
    if (re.test(cleaned)) return def;
  }
  return null;
}

function toNumber(raw: string): number {
  return parseFloat(raw.replace(",", "."));
}

/**
 * Parse a size out of free text. Returns undefined if nothing usable found.
 * Strategy: prefer explicit multipacks ("6 x 330ml"), then single measures
 * ("415g"), then bare counts ("12 pack", "80 tea bags").
 */
export function parseSize(text: string): ParsedSize | undefined {
  if (!text) return undefined;

  // 1. Multipack: "6 x 330ml", "2x110 g", "4 X 550ml"
  const multi = text.match(
    new RegExp(String.raw`(\d+)\s*[xX×]\s*${NUM}\s*([a-zA-Z]+)\b`),
  );
  if (multi) {
    const def = resolveUnit(multi[3]);
    if (def) {
      return {
        count: parseInt(multi[1], 10),
        amount: toNumber(multi[2]) * def.factor,
        unit: def.unit,
      };
    }
  }

  // 2. Single measure with unit attached or spaced: "415g", "1.5 kg", "75cl"
  //    Scan all candidates and take the first that resolves to a real unit.
  const measureRe = new RegExp(String.raw`${NUM}\s*([a-zA-Z]+)\b`, "g");
  for (const m of text.matchAll(measureRe)) {
    const def = resolveUnit(m[2]);
    if (def) {
      return { count: 1, amount: toNumber(m[1]) * def.factor, unit: def.unit };
    }
  }

  // 3. Bare counts: "12 pack", "80 Tea Bags", "Pack of 6", "40 washes"
  const packOf = text.match(/pack\s+of\s+(\d+)/i);
  if (packOf) {
    return { count: 1, amount: parseInt(packOf[1], 10), unit: "each" };
  }
  // Try the two-word phrase ("Tea Bags") before the single word ("Bags").
  const countRe = /(\d+)\s+([a-zA-Z]+)(?:\s+([a-zA-Z]+))?/g;
  for (const m of text.matchAll(countRe)) {
    const twoWords = m[3] ? `${m[2]} ${m[3]}` : undefined;
    if ((twoWords && COUNT_WORDS.test(twoWords)) || COUNT_WORDS.test(m[2])) {
      return { count: 1, amount: parseInt(m[1], 10), unit: "each" };
    }
  }

  return undefined;
}

/**
 * Pence per reference quantity (100g, 100ml, or 1 each) for a pack.
 * Returns undefined when size is missing or zero.
 */
export function unitPricePence(
  pricePence: number,
  size: ParsedSize | undefined,
): number | undefined {
  if (!size) return undefined;
  const total = size.count * size.amount;
  if (total <= 0) return undefined;
  const ref = size.unit === "each" ? 1 : 100;
  return (pricePence / total) * ref;
}

/** Human-readable size, e.g. "6 × 330ml" or "415g" or "80 each". */
export function formatSize(size: ParsedSize): string {
  const amount =
    size.unit === "each"
      ? `${size.amount}`
      : size.amount >= 1000 && size.unit === "g"
        ? `${size.amount / 1000}kg`
        : size.amount >= 1000 && size.unit === "ml"
          ? `${size.amount / 1000}L`
          : `${Math.round(size.amount * 10) / 10}${size.unit}`;
  const suffix = size.unit === "each" ? " each" : "";
  return size.count > 1 ? `${size.count} × ${amount}${suffix}` : `${amount}${suffix}`;
}
