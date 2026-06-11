import type { AmazonProvider, BasketProvider } from "./types";
import { MockOcadoProvider } from "./ocado/MockOcadoProvider";
import { MockAmazonProvider } from "./amazon/MockAmazonProvider";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";

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

  const cred = await db.credential.findUnique({ where: { service: "ocado" } });
  if (!cred) {
    throw new Error(
      "No Ocado credentials saved — add them on the Settings page.",
    );
  }
  const { OcadoBasketProvider } = await import("./ocado/OcadoBasketProvider");
  return new OcadoBasketProvider({
    username: cred.username,
    password: decrypt(cred.encryptedPassword),
  });
}

export async function getAmazonProvider(): Promise<AmazonProvider> {
  if (mode() === "mock") return new MockAmazonProvider();
  const { ApifyAmazonProvider } = await import("./amazon/ApifyAmazonProvider");
  return new ApifyAmazonProvider();
}
