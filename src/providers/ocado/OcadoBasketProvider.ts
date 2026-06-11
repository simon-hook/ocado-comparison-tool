import { chromium, type BrowserContext, type Page } from "playwright";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { CanonicalItem } from "@/types/canonical";
import { BasketAuthError, type BasketProvider } from "../types";
import { toCanonical } from "../normalise";

/**
 * Fetches the live Ocado basket by logging in with Playwright.
 *
 * Session cookies are persisted to .data/ocado-session.json so login only
 * happens when the session expires. If Ocado challenges with captcha/MFA the
 * provider throws BasketAuthError and the UI shows a "needs manual sign-in"
 * state rather than hammering the login.
 *
 * NOTE: selectors below are best-effort against Ocado's current SPA and are
 * centralised here so a site change is a one-file fix. Verify against the
 * live site (DevTools) on first run — see README "Going live".
 */

const OCADO = {
  loginUrl: "https://www.ocado.com/webshop/startLogin.do",
  trolleyUrl: "https://www.ocado.com/trolley",
  selectors: {
    cookieAccept: "#onetrust-accept-btn-handler",
    username: 'input[name="username"], input[type="email"]',
    password: 'input[name="password"], input[type="password"]',
    loginSubmit: 'button[type="submit"]',
    loggedInMarker: '[data-test="user-menu"], a[href*="logout"]',
    trolleyItem: '[data-test="trolley-item"], [class*="trolley-item"]',
    itemTitle: '[data-test="item-title"], a[class*="title"]',
    itemPrice: '[data-test="item-price"], [class*="price"]',
    itemQuantity: 'input[data-test="quantity"], [class*="quantity"] input',
    itemLink: "a[href*='/products/']",
  },
} as const;

const SESSION_DIR = path.join(process.cwd(), ".data");
const SESSION_FILE = path.join(SESSION_DIR, "ocado-session.json");

export interface OcadoCredentials {
  username: string;
  password: string;
}

function parsePricePence(text: string): number | undefined {
  const m = text.replace(/,/g, "").match(/£?\s*(\d+(?:\.\d{1,2})?)/);
  return m ? Math.round(parseFloat(m[1]) * 100) : undefined;
}

export class OcadoBasketProvider implements BasketProvider {
  constructor(private readonly credentials: OcadoCredentials) {}

  async fetchBasket(): Promise<CanonicalItem[]> {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        storageState: existsSync(SESSION_FILE) ? SESSION_FILE : undefined,
        viewport: { width: 1280, height: 900 },
        locale: "en-GB",
      });
      const page = await context.newPage();

      await page.goto(OCADO.trolleyUrl, { waitUntil: "domcontentloaded" });
      await this.dismissCookieBanner(page);

      if (!(await this.isLoggedIn(page))) {
        await this.login(page);
        await page.goto(OCADO.trolleyUrl, { waitUntil: "domcontentloaded" });
      }

      const items = await this.scrapeTrolley(page);
      await this.saveSession(context);
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

  private async login(page: Page): Promise<void> {
    await page.goto(OCADO.loginUrl, { waitUntil: "domcontentloaded" });
    await this.dismissCookieBanner(page);

    try {
      await page
        .locator(OCADO.selectors.username)
        .first()
        .fill(this.credentials.username, { timeout: 10000 });
      await page
        .locator(OCADO.selectors.password)
        .first()
        .fill(this.credentials.password);
      await page.locator(OCADO.selectors.loginSubmit).first().click();
      await page.waitForLoadState("networkidle", { timeout: 20000 });
    } catch {
      throw new BasketAuthError(
        "Could not complete Ocado login form — the page layout may have changed.",
      );
    }

    // Captcha / MFA / failed credentials all surface as "still not logged in".
    if (!(await this.isLoggedIn(page))) {
      throw new BasketAuthError(
        "Ocado login did not succeed (possible captcha, MFA or wrong credentials). " +
          "Sign in manually in a browser, or retry later.",
      );
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
