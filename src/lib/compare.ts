import type {
  CanonicalItem,
  ComparisonReport,
  MatchResult,
} from "@/types/canonical";
import { matchItem } from "@/matching/matcher";
import { buildSearchQuery } from "@/providers/normalise";
import { getAmazonProvider, getBasketProvider } from "@/providers/factory";
import { db } from "@/lib/db";

/** Amazon search results are reused for this long before re-fetching. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — weekly shop, daily freshness

async function cachedSearch(query: string): Promise<CanonicalItem[]> {
  const cacheKey = query.toLowerCase().trim();
  const hit = await db.priceCache.findUnique({ where: { cacheKey } });
  if (hit && Date.now() - hit.fetchedAt.getTime() < CACHE_TTL_MS) {
    return JSON.parse(hit.payload) as CanonicalItem[];
  }

  const amazon = await getAmazonProvider();
  const results = await amazon.search(query);

  await db.priceCache.upsert({
    where: { cacheKey },
    create: { cacheKey, payload: JSON.stringify(results) },
    update: { payload: JSON.stringify(results), fetchedAt: new Date() },
  });
  return results;
}

/**
 * Full pipeline: fetch basket -> (optionally restrict to watchlist) ->
 * search Amazon per item (cached) -> match -> savings report.
 */
export async function compareBasket(
  options: { watchlistOnly?: boolean } = {},
): Promise<ComparisonReport> {
  const basketProvider = await getBasketProvider();
  let basket = await basketProvider.fetchBasket();

  if (options.watchlistOnly) {
    const watchlist = await db.watchlistItem.findMany();
    const skus = new Set(watchlist.map((w) => w.ocadoSku));
    basket = basket.filter((item) => skus.has(item.id));
  }

  const mappings = await db.productMapping.findMany();
  const asinBySku = new Map(mappings.map((m) => [m.ocadoSku, m.asin]));

  const items: MatchResult[] = [];
  for (const ocadoItem of basket) {
    const query = buildSearchQuery(ocadoItem);
    let candidates: CanonicalItem[] = [];
    try {
      candidates = await cachedSearch(query);
    } catch (err) {
      console.error(`Amazon search failed for "${query}":`, err);
    }
    items.push(
      matchItem(ocadoItem, candidates, {
        confirmedAsin: asinBySku.get(ocadoItem.id),
      }),
    );
  }

  const totalPotentialSavingsPence = items.reduce(
    (sum, r) =>
      sum +
      (r.bestMatch && r.bestMatch.savings.savingsPence > 0
        ? r.bestMatch.savings.savingsPence
        : 0),
    0,
  );

  return {
    items,
    totalPotentialSavingsPence,
    generatedAt: new Date().toISOString(),
  };
}
