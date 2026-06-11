import type { CanonicalItem, Source } from "@/types/canonical";
import { parseSize, unitPricePence } from "@/matching/sizeParser";

/** Raw shape shared by fixtures and live provider output. */
export interface RawProduct {
  id: string;
  title: string;
  brand?: string;
  quantity?: number;
  pricePence: number;
  url: string;
  image?: string;
  primeEligible?: boolean;
  /** Optional explicit size string when the source provides one separately. */
  sizeText?: string;
}

/** Build a CanonicalItem: parse size from sizeText or title, derive unit price. */
export function toCanonical(source: Source, raw: RawProduct): CanonicalItem {
  const size =
    (raw.sizeText ? parseSize(raw.sizeText) : undefined) ?? parseSize(raw.title);
  return {
    source,
    id: raw.id,
    title: raw.title,
    brand: raw.brand,
    size,
    quantity: raw.quantity ?? 1,
    pricePence: raw.pricePence,
    unitPricePence: unitPricePence(raw.pricePence, size),
    url: raw.url,
    image: raw.image,
    primeEligible: raw.primeEligible,
  };
}

/** Build the Amazon search query for an Ocado item: brand + de-noised name. */
export function buildSearchQuery(item: CanonicalItem): string {
  const title = item.title
    // strip pack sizes; Amazon sizes differ and unit price handles it
    .replace(/\d+(?:[.,]\d+)?\s*(?:kg|g|mg|ml|cl|l|ltr|litres?|pints?)\b/gi, " ")
    .replace(/\d+\s*[x×]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const brand = item.brand ?? "";
  const q = title.toLowerCase().startsWith(brand.toLowerCase())
    ? title
    : `${brand} ${title}`.trim();
  return q;
}
