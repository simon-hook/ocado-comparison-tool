import { fuzzy } from "fast-fuzzy";
import type { CanonicalItem } from "@/types/canonical";
import type { AmazonProvider } from "../types";
import { toCanonical } from "../normalise";
import fixture from "./__fixtures__/searchResults.json";

/**
 * Serves fixture search results — used for development and tests.
 * Picks the fixture bucket whose key best fuzzy-matches the query.
 */
export class MockAmazonProvider implements AmazonProvider {
  async search(query: string): Promise<CanonicalItem[]> {
    const buckets = Object.entries(fixture.results);
    let best: { key: string; score: number } | undefined;
    for (const [key] of buckets) {
      const score = fuzzy(key, query.toLowerCase());
      if (!best || score > best.score) best = { key, score };
    }
    if (!best || best.score < 0.5) return [];
    const raw = fixture.results[best.key as keyof typeof fixture.results];
    return raw.map((r) =>
      toCanonical("amazon", {
        id: r.asin,
        title: r.title,
        brand: r.brand,
        pricePence: r.pricePence,
        url: r.url,
        primeEligible: r.primeEligible,
      }),
    );
  }
}
