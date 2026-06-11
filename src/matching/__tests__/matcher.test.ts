import { describe, expect, it } from "vitest";
import type { CanonicalItem } from "@/types/canonical";
import { matchItem, normaliseTitle, scoreCandidate } from "../matcher";
import { computeSavings } from "../savings";

function ocadoItem(overrides: Partial<CanonicalItem> = {}): CanonicalItem {
  return {
    source: "ocado",
    id: "sku-1",
    title: "Heinz Baked Beans 415g",
    brand: "Heinz",
    size: { count: 1, amount: 415, unit: "g" },
    quantity: 2,
    pricePence: 140,
    url: "https://www.ocado.com/products/sku-1",
    ...overrides,
  };
}

function amazonItem(overrides: Partial<CanonicalItem> = {}): CanonicalItem {
  return {
    source: "amazon",
    id: "B000ASIN1",
    title: "Heinz Baked Beanz 415g (Pack of 1)",
    brand: "Heinz",
    size: { count: 1, amount: 415, unit: "g" },
    quantity: 1,
    pricePence: 100,
    url: "https://www.amazon.co.uk/dp/B000ASIN1",
    primeEligible: true,
    ...overrides,
  };
}

describe("normaliseTitle", () => {
  it("strips sizes, punctuation and noise, sorts tokens", () => {
    expect(normaliseTitle("Heinz Baked Beans 415g")).toBe("baked beans heinz");
    expect(normaliseTitle("Beans Baked, Heinz! (415g)")).toBe(
      "baked beans heinz",
    );
  });
});

describe("scoreCandidate", () => {
  it("scores a near-identical product highly", () => {
    expect(scoreCandidate(ocadoItem(), amazonItem())).toBeGreaterThan(0.8);
  });

  it("scores an unrelated product low", () => {
    const unrelated = amazonItem({
      title: "Dyson V8 Cordless Vacuum Cleaner",
      brand: "Dyson",
      size: undefined,
    });
    expect(scoreCandidate(ocadoItem(), unrelated)).toBeLessThan(0.4);
  });

  it("penalises unit mismatch (g vs ml)", () => {
    const liquid = amazonItem({ size: { count: 1, amount: 415, unit: "ml" } });
    const solid = amazonItem();
    expect(scoreCandidate(ocadoItem(), liquid)).toBeLessThan(
      scoreCandidate(ocadoItem(), solid),
    );
  });
});

describe("matchItem", () => {
  it("selects the best Prime candidate above threshold", () => {
    const good = amazonItem();
    const bad = amazonItem({
      id: "B000ASIN2",
      title: "Branston Baked Beans 410g",
      brand: "Branston",
    });
    const result = matchItem(ocadoItem(), [bad, good]);
    expect(result.bestMatch?.item.id).toBe("B000ASIN1");
  });

  it("excludes non-Prime candidates entirely", () => {
    const nonPrime = amazonItem({ primeEligible: false });
    const result = matchItem(ocadoItem(), [nonPrime]);
    expect(result.bestMatch).toBeUndefined();
    expect(result.candidates).toHaveLength(0);
  });

  it("returns no bestMatch when nothing clears the threshold", () => {
    const unrelated = amazonItem({
      title: "USB-C Charging Cable 2m",
      brand: "Anker",
      size: undefined,
    });
    const result = matchItem(ocadoItem(), [unrelated]);
    expect(result.bestMatch).toBeUndefined();
    expect(result.candidates.length).toBe(1); // still offered for fix-match
  });

  it("prefers better savings among near-equal-confidence candidates", () => {
    // Same product, two pack sizes: the cheaper-per-unit one should win.
    const single = amazonItem({ id: "B0SINGLE", pricePence: 130 });
    const bulkCheap = amazonItem({
      id: "B0BULK",
      title: "Heinz Baked Beanz 415g (Pack of 6)",
      size: { count: 6, amount: 415, unit: "g" },
      pricePence: 540, // 90p/can vs 130p single
    });
    const result = matchItem(ocadoItem(), [single, bulkCheap]);
    expect(result.bestMatch?.item.id).toBe("B0BULK");
  });

  it("honours a confirmed ASIN mapping over fuzzy ranking", () => {
    const fuzzyWinner = amazonItem();
    const confirmed = amazonItem({
      id: "B000CONFIRMED",
      title: "Heinz Beans Family Pack",
    });
    const result = matchItem(ocadoItem(), [fuzzyWinner, confirmed], {
      confirmedAsin: "B000CONFIRMED",
    });
    expect(result.bestMatch?.item.id).toBe("B000CONFIRMED");
    expect(result.fromConfirmedMapping).toBe(true);
  });
});

describe("computeSavings", () => {
  it("compares on unit price when both sizes known (same unit)", () => {
    // Ocado: 2 x 415g @ 140p -> line cost 280p
    // Amazon: 415g @ 100p -> same product amount costs 200p -> save 80p
    const s = computeSavings(ocadoItem(), amazonItem());
    expect(s.basis).toBe("unit");
    expect(s.savingsPence).toBe(80);
    expect(s.savingsFraction).toBeCloseTo(80 / 280);
  });

  it("scales fairly across different pack sizes", () => {
    // Amazon sells a 4-pack (4x415g) at 360p -> 21.7p/100g vs Ocado 33.7p/100g
    const fourPack = amazonItem({
      size: { count: 4, amount: 415, unit: "g" },
      pricePence: 360,
    });
    const s = computeSavings(ocadoItem(), fourPack);
    expect(s.basis).toBe("unit");
    // Ocado line: 830g for 280p. Amazon equivalent: 830 * (360/1660) = 180p
    expect(s.savingsPence).toBe(100);
  });

  it("falls back to pack price when sizes unknown", () => {
    const o = ocadoItem({ size: undefined, unitPricePence: undefined });
    const a = amazonItem({ size: undefined });
    const s = computeSavings(o, a);
    expect(s.basis).toBe("pack");
    expect(s.savingsPence).toBe((140 - 100) * 2);
  });

  it("reports negative savings when Amazon is dearer", () => {
    const dearer = amazonItem({ pricePence: 200 });
    const s = computeSavings(ocadoItem(), dearer);
    expect(s.savingsPence).toBeLessThan(0);
  });
});
