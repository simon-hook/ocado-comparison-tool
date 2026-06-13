import { chromium, type BrowserContext, type Page } from "playwright";
import { existsSync, mkdirSync } from "node:fs";
import type { CanonicalItem } from "@/types/canonical";
import { BasketAuthError, type BasketProvider } from "../types";
import { toCanonical } from "../normalise";
import { SESSION_DIR, SESSION_FILE } from "./session";

/**
 * Fetches the live Ocado basket with Playwright, reusing a session created
 * interactively via `npm run ocado:login` (see scripts/ocado-login.mjs).
 *
 * We deliberately do NOT automate Ocado's JS-rendered login form: it's brittle
 * and can't clear MFA/captcha. Instead the user signs in once in a real browser
 * window; the session cookies are saved to .data/ocado-session.json and reused
 * here headlessly until they expire.
 *
 * NOTE: the trolley selectors below are best-effort against Ocado's current SPA
 * and centralised here so a site change is a one-file fix. Verify against the
 * live site (DevTools) on first run — see README "Going live".
 */

const OCADO = {
  trolleyUrl: "https://www.ocado.com/basket",
  selectors: {
    cookieAccept: "#onetrust-accept-btn-handler",
    loggedInMarker: '[data-test="user-menu"], a[href*="logout"]',
    trolleyItem: '[data-test="trolley-item"], [class*="trolley-item"]',
    itemTitle: '[data-test="item-title"], a[class*="title"]',
    itemPrice: '[data-test="item-price"], [class*="price"]',
    itemQuantity: 'input[data-test="quantity"], [class*="quantity"] input',
    itemLink: "a[href*='/products/']",
  },
} as const;

function parsePricePence(text: string): number | undefined {
  const m = text.replace(/,/g, "").match(/£?\s*(\d+(?:\.\d{1,2})?)/);
  return m ? Math.round(parseFloat(m[1]) * 100) : undefined;
}

export class OcadoBasketProvider implements BasketProvider {

  async fetchBasket(): Promise<CanonicalItem[]> {
    // We rely on a session created interactively via `npm run ocado:login`.
    // Automating Ocado's JS-rendered login form headlessly is fragile and
    // can't clear MFA/captcha; reusing a real session is far more robust.
    if (!existsSync(SESSION_FILE)) {
      throw new BasketAuthError(
        "No saved Ocado session. Run `npm run ocado:login` once to sign in, " +
          "then try again.",
      );
    }

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        storageState: SESSION_FILE,
        viewport: { width: 1280, height: 900 },
        locale: "en-GB",
      });
      const page = await context.newPage();

      await page.goto(OCADO.trolleyUrl, { waitUntil: "domcontentloaded" });
      await this.dismissCookieBanner(page);

      if (!(await this.isLoggedIn(page))) {
        throw new BasketAuthError(
          "Your saved Ocado session has expired. Run `npm run ocado:login` " +
            "to sign in again, then retry.",
        );
      }

      const items = await this.scrapeTrolley(page);
      await this.saveSession(context); // refresh rolling cookies
      return items;
    } finally {
      await browser.close();
    }
  }

  private async dismissCookieBanner(page: Page): Promise<void> {
    try {
      await page
        .locator(OCADO.selectors.cookieAccept)
        .click({ timeout: 3000 });
    } catch {
      // banner not shown — fine
    }
  }

  private async isLoggedIn(page: Page): Promise<boolean> {
    try {
      await page
        .locator(OCADO.selectors.loggedInMarker)
        .first()
        .waitFor({ timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  private async scrapeTrolley(page: Page): Promise<CanonicalItem[]> {
    await page
      .locator(OCADO.selectors.trolleyItem)
      .first()
      .waitFor({ timeout: 15000 })
      .catch(() => {
        // Empty basket is legitimate — return [] below if no rows.
      });

    const rows = page.locator(OCADO.selectors.trolleyItem);
    const count = await rows.count();
    const items: CanonicalItem[] = [];

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const title =
        (await row
          .locator(OCADO.selectors.itemTitle)
          .first()
          .textContent()
          .catch(() => null)) ?? "";
      const priceText =
        (await row
          .locator(OCADO.selectors.itemPrice)
          .first()
          .textContent()
          .catch(() => null)) ?? "";
      const qtyValue = await row
        .locator(OCADO.selectors.itemQuantity)
        .first()
        .inputValue()
        .catch(() => "1");
      const href =
        (await row
          .locator(OCADO.selectors.itemLink)
          .first()
          .getAttribute("href")
          .catch(() => null)) ?? "";

      const pricePence = parsePricePence(priceText);
      if (!title.trim() || pricePence === undefined) continue;

      // Ocado product URLs end in the SKU: /products/some-name-13175011
      const sku = href.match(/(\d+)\/?$/)?.[1] ?? `row-${i}`;

      items.push(
        toCanonical("ocado", {
          id: sku,
          title: title.trim(),
          quantity: Math.max(1, parseInt(qtyValue, 10) || 1),
          pricePence,
          url: href.startsWith("http") ? href : `https://www.ocado.com${href}`,
        }),
      );
    }

    return items;
  }

  private async saveSession(context: BrowserContext): Promise<void> {
    mkdirSync(SESSION_DIR, { recursive: true });
    await context.storageState({ path: SESSION_FILE });
  }
}
