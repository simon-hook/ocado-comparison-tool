import type { AmazonProvider, BasketProvider } from "./types";
import { MockOcadoProvider } from "./ocado/MockOcadoProvider";
import { MockAmazonProvider } from "./amazon/MockAmazonProvider";

/**
 * PROVIDERS_MODE=mock  -> fixture providers (default; safe for development)
 * PROVIDERS_MODE=live  -> real Ocado (Playwright) + Apify Amazon
 *
 * Live providers are imported lazily so the mock path never loads Playwright.
 */

function mode(): "mock" | "live" {
  return process.env.PROVIDERS_MODE === "live" ? "live" : "mock";
}

export async function getBasketProvider(): Promise<BasketProvider> {
  if (mode() === "mock") return new MockOcadoProvider();

  // Live auth is via the saved session from `npm run ocado:login` — no stored
  // password needed. The provider throws a helpful BasketAuthError if missing.
  const { OcadoBasketProvider } = await import("./ocado/OcadoBasketProvider");
  return new OcadoBasketProvider();
}

export async function getAmazonProvider(): Promise<AmazonProvider> {
  if (mode() === "mock") return new MockAmazonProvider();
  const { ApifyAmazonProvider } = await import("./amazon/ApifyAmazonProvider");
  return new ApifyAmazonProvider();
}
