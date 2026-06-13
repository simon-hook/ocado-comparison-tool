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

// Ocado's CSS classes are randomised per build, so we anchor on its stable
// data-test attributes instead (verified live, June 2026).
const OCADO = {
  basketUrl: "https://www.ocado.com/basket",
  selectors: {
    cookieAccept: "#onetrust-accept-btn-handler",
    loggedInMarker: '[data-test="account-dropdown-button"]',
    // Each basket line is a product card containing a price + product link.
    basketItem: ".product-card-container",
    emptyBasket: '[data-test="empty-basket-button"]',
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

      await page.goto(OCADO.basketUrl, { waitUntil: "domcontentloaded" });
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
    // A redirect to a sign-in/welcome page means the session is gone.
    if (/sign-?in|login|register|welcome/i.test(page.url())) return false;
    try {
      await page
        .locator(OCADO.selectors.loggedInMarker)
        .first()
        .waitFor({ timeout: 8000 });
      return true;
    } catch {
      return false;
    }
  }

  private async scrapeTrolley(page: Page): Promise<CanonicalItem[]> {
    // Wait for either basket lines or the empty-basket state to render.
    await page
      .locator(`${OCADO.selectors.basketItem}, ${OCADO.selectors.emptyBasket}`)
      .first()
      .waitFor({ timeout: 15000 })
      .catch(() => {
        // Empty/slow basket — return [] below if no rows are found.
      });

    // Extract per-line fields in the browser using stable data-test hooks.
    const rows = await page.evaluate((sel) => {
      const clean = (el: Element | null | undefined) =>
        (el?.textContent ?? "").replace(/\s+/g, " ").trim();

      return Array.from(document.querySelectorAll(sel.basketItem))
        .filter(
          (card) =>
            !card.closest('[data-test^="carousel"]') &&
            card.querySelector('[data-test="fop-price"]') &&
            card.querySelector('[data-test="fop-product-link"]'),
        )
        .map((card) => {
          const qtyEl = card.querySelector('[data-test="quantity-in-basket"]');
          let qtyText = qtyEl
            ? (qtyEl as HTMLInputElement).value || clean(qtyEl)
            : "";
          if (!/\d/.test(qtyText)) {
            const m = clean(card).match(/You have (\d+) of this item/i);
            qtyText = m ? m[1] : "1";
          }
          // fop-size's first span is the pack weight/size, e.g. "40g".
          const sizeEl = card.querySelector('[data-test="fop-size"]');
          return {
            href:
              card
                .querySelector('[data-test="fop-product-link"]')
                ?.getAttribute("href") ?? "",
            title: clean(card.querySelector('[data-test="fop-title"]')),
            priceText: clean(card.querySelector('[data-test="fop-price"]')),
            sizeText: clean(sizeEl?.querySelector("span")),
            qtyText,
          };
        });
    }, OCADO.selectors);

    const items: CanonicalItem[] = [];
    for (const row of rows) {
      const linePence = parsePricePence(row.priceText);
      if (!row.title || linePence === undefined) continue;

      const quantity = Math.max(1, parseInt(row.qtyText, 10) || 1);
      // Ocado product URLs end in the SKU: /products/<slug>/583657011
      const sku = row.href.match(/(\d+)\/?$/)?.[1] ?? row.href;

      items.push(
        toCanonical("ocado", {
          id: sku,
          title: row.title,
          quantity,
          // fop-price is the line total for the quantity; store per-pack price
          // so downstream `pricePence * quantity` reconstructs the line cost.
          pricePence: Math.round(linePence / quantity),
          url: row.href.startsWith("http")
            ? row.href
            : `https://www.ocado.com${row.href}`,
          sizeText: row.sizeText || undefined,
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
