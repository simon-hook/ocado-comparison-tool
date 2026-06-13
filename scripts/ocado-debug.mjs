// Diagnostic: open the Ocado trolley with the saved session and report what
// the page actually looks like, so we can fix the scraper selectors.
//
//   npm run ocado:debug
//
// It prints the final URL, page title, and the HTML of a few likely product
// rows, and saves a full screenshot + HTML to .data/ for inspection.
import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";

const SESSION_DIR = path.join(process.cwd(), ".data");
const SESSION_FILE = path.join(SESSION_DIR, "ocado-session.json");
const TROLLEY_URL = "https://www.ocado.com/trolley";

function waitForEnter(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, () => { rl.close(); r(); }));
}

async function main() {
  if (!existsSync(SESSION_FILE)) {
    console.error("No saved session. Run `npm run ocado:login` first.");
    process.exit(1);
  }
  mkdirSync(SESSION_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: SESSION_FILE,
    viewport: { width: 1280, height: 900 },
    locale: "en-GB",
  });
  const page = await context.newPage();

  await page.goto(TROLLEY_URL, { waitUntil: "domcontentloaded" });
  try {
    await page.locator("#onetrust-accept-btn-handler").click({ timeout: 3000 });
  } catch {}
  // Give the single-page app time to render the trolley.
  await page.waitForTimeout(5000);

  console.log("\n==================== OCADO PAGE REPORT ====================");
  console.log("Final URL :", page.url());
  console.log("Title     :", await page.title());

  // Quick signal: does this look like a login page?
  const looksLikeLogin = /login|sign.?in/i.test(page.url());
  console.log("Login page:", looksLikeLogin ? "LIKELY (session not applied)" : "no");

  // Count some candidate hooks.
  const counts = await page.evaluate(() => ({
    productLinks: document.querySelectorAll('a[href*="/products/"]').length,
    dataTestAttrs: document.querySelectorAll("[data-test]").length,
    pricePounds: Array.from(document.querySelectorAll("*")).filter(
      (e) => e.children.length === 0 && /£\s*\d/.test(e.textContent || ""),
    ).length,
  }));
  console.log("Counts    :", JSON.stringify(counts));

  // Heuristic: from each product link, climb to the nearest ancestor that also
  // contains a price, and dump that container's HTML — that's a basket row.
  const rows = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/products/"]'));
    const seen = new Set();
    const out = [];
    for (const link of links) {
      let el = link;
      for (let i = 0; i < 8 && el; i++) {
        if (/£\s*\d/.test(el.textContent || "")) break;
        el = el.parentElement;
      }
      if (!el) continue;
      const sig = `${el.tagName}.${el.className}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push({
        tag: el.tagName,
        className: el.className,
        dataTest: el.getAttribute("data-test"),
        html: el.outerHTML.slice(0, 2500),
      });
      if (out.length >= 3) break;
    }
    return out;
  });

  console.log(`\nFound ${rows.length} candidate basket row(s):`);
  rows.forEach((r, i) => {
    console.log(`\n--------- candidate row ${i + 1} ---------`);
    console.log(`container: <${r.tag.toLowerCase()} class="${r.className}" data-test="${r.dataTest}">`);
    console.log(r.html);
  });

  const htmlPath = path.join(SESSION_DIR, "ocado-trolley.html");
  const shotPath = path.join(SESSION_DIR, "ocado-trolley.png");
  writeFileSync(htmlPath, await page.content());
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log(`\nSaved full HTML  -> ${htmlPath}`);
  console.log(`Saved screenshot -> ${shotPath}`);
  console.log("===========================================================\n");
  console.log("Check the browser window: can you see your basket items?");

  await waitForEnter("Press Enter to close… ");
  await browser.close();
}

main().catch((err) => {
  console.error("\nDebug helper failed:", err);
  process.exit(1);
});
