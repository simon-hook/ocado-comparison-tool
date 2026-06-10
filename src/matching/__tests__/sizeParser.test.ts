import { describe, expect, it } from "vitest";
import { parseSize, unitPricePence, formatSize } from "../sizeParser";

describe("parseSize", () => {
  it("parses simple gram weights", () => {
    expect(parseSize("Heinz Baked Beans 415g")).toEqual({
      count: 1,
      amount: 415,
      unit: "g",
    });
  });

  it("parses kilograms to grams", () => {
    expect(parseSize("Basmati Rice 1.5kg")).toEqual({
      count: 1,
      amount: 1500,
      unit: "g",
    });
  });

  it("parses litres to ml", () => {
    expect(parseSize("Whole Milk 2L")).toEqual({
      count: 1,
      amount: 2000,
      unit: "ml",
    });
  });

  it("parses centilitres", () => {
    expect(parseSize("Prosecco 75cl")).toEqual({
      count: 1,
      amount: 750,
      unit: "ml",
    });
  });

  it("parses pints", () => {
    expect(parseSize("Semi Skimmed Milk 4 Pints")).toEqual({
      count: 1,
      amount: 4 * 568,
      unit: "ml",
    });
  });

  it("parses multipacks", () => {
    expect(parseSize("Coca-Cola 6 x 330ml")).toEqual({
      count: 6,
      amount: 330,
      unit: "ml",
    });
  });

  it("parses multipacks without spaces", () => {
    expect(parseSize("Yeo Valley Yogurt 4x110g")).toEqual({
      count: 4,
      amount: 110,
      unit: "g",
    });
  });

  it("parses bare counts as each", () => {
    expect(parseSize("Yorkshire Tea 80 Tea Bags")).toEqual({
      count: 1,
      amount: 80,
      unit: "each",
    });
  });

  it("parses 'pack of N'", () => {
    expect(parseSize("Kitchen Roll Pack of 6")).toEqual({
      count: 1,
      amount: 6,
      unit: "each",
    });
  });

  it("parses comma decimals", () => {
    expect(parseSize("Olive Oil 0,5 l")).toEqual({
      count: 1,
      amount: 500,
      unit: "ml",
    });
  });

  it("returns undefined when no size present", () => {
    expect(parseSize("Fresh Coriander")).toBeUndefined();
  });

  it("ignores non-unit letter sequences", () => {
    // "Size 4" in nappies shouldn't parse as 4 of anything weighty
    const result = parseSize("Pampers Nappies Size 4, 76 Nappies");
    expect(result).toEqual({ count: 1, amount: 76, unit: "each" });
  });
});

describe("unitPricePence", () => {
  it("computes pence per 100g", () => {
    expect(unitPricePence(200, { count: 1, amount: 400, unit: "g" })).toBe(50);
  });

  it("computes pence per 100ml across multipacks", () => {
    // 6 x 330ml = 1980ml at £5.94 -> 30p per 100ml
    expect(unitPricePence(594, { count: 6, amount: 330, unit: "ml" })).toBe(30);
  });

  it("computes pence per each", () => {
    expect(unitPricePence(400, { count: 1, amount: 80, unit: "each" })).toBe(5);
  });

  it("returns undefined without size", () => {
    expect(unitPricePence(100, undefined)).toBeUndefined();
  });
});

describe("formatSize", () => {
  it("formats singles and multipacks", () => {
    expect(formatSize({ count: 1, amount: 415, unit: "g" })).toBe("415g");
    expect(formatSize({ count: 6, amount: 330, unit: "ml" })).toBe("6 × 330ml");
    expect(formatSize({ count: 1, amount: 1500, unit: "g" })).toBe("1.5kg");
    expect(formatSize({ count: 1, amount: 80, unit: "each" })).toBe("80 each");
  });
});
