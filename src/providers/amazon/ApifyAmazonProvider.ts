import { ApifyClient } from "apify-client";
import type { CanonicalItem } from "@/types/canonical";
import type { AmazonProvider } from "../types";
import { toCanonical } from "../normalise";

/**
 * Amazon UK search via an Apify scraper actor, staying inside Apify's free
 * monthly platform credits at personal volume.
 *
 * Defaults to junglee/amazon-crawler fed with an amazon.co.uk search URL.
 * Override with APIFY_ACTOR_ID if you prefer a different actor; the result
 * mapping below reads the common field names defensively.
 */

const DEFAULT_ACTOR = "junglee/amazon-crawler";
const MAX_RESULTS = 8;

/* eslint-disable @typescript-eslint/no-explicit-any */
type ActorItem = Record<string, any>;

function readPricePence(item: ActorItem): number | undefined {
  // Common shapes across actors: price.value (GBP float), price (float|string)
  const candidates = [item.price?.value, item.price, item.currentPrice?.value];
  for (const c of candidates) {
    if (typeof c === "number" && c > 0) return Math.round(c * 100);
    if (typeof c === "string") {
      const m = c.replace(/[£,]/g, "").match(/\d+(?:\.\d{1,2})?/);
      if (m) return Math.round(parseFloat(m[0]) * 100);
    }
  }
  return undefined;
}

function readPrime(item: ActorItem): boolean | undefined {
  const flags = [item.isPrime, item.prime, item.isPrimeEligible, item.hasPrime];
  for (const f of flags) if (typeof f === "boolean") return f;
  return undefined; // unknown: matcher lets it through, UI labels it
}

export class ApifyAmazonProvider implements AmazonProvider {
  private readonly client: ApifyClient;
  private readonly actorId: string;

  constructor(token = process.env.APIFY_TOKEN, actorId = process.env.APIFY_ACTOR_ID) {
    if (!token) throw new Error("APIFY_TOKEN is not set");
    this.client = new ApifyClient({ token });
    this.actorId = actorId || DEFAULT_ACTOR;
  }

  async search(query: string): Promise<CanonicalItem[]> {
    const searchUrl = `https://www.amazon.co.uk/s?k=${encodeURIComponent(query)}`;

    const run = await this.client.actor(this.actorId).call(
      {
        categoryOrProductUrls: [{ url: searchUrl }],
        maxItemsPerStartUrl: MAX_RESULTS,
        maxOffers: 0,
        scrapeProductDetails: false,
        ensureLoadedProductDescriptionFields: false,
        useCaptchaSolver: false,
        proxyConfiguration: { useApifyProxy: true },
      },
      { timeout: 120, memory: 1024 },
    );

    const { items } = await this.client
      .dataset(run.defaultDatasetId)
      .listItems({ limit: MAX_RESULTS });

    return (items as ActorItem[])
      .map((raw) => {
        const pricePence = readPricePence(raw);
        const asin = raw.asin ?? raw.ASIN;
        if (!pricePence || !asin || !raw.title) return undefined;
        return toCanonical("amazon", {
          id: String(asin),
          title: String(raw.title),
          brand: raw.brand ? String(raw.brand) : undefined,
          pricePence,
          url: raw.url ?? `https://www.amazon.co.uk/dp/${asin}`,
          image: raw.thumbnailImage ?? raw.image ?? undefined,
          primeEligible: readPrime(raw),
        });
      })
      .filter((i): i is CanonicalItem => i !== undefined);
  }
}
