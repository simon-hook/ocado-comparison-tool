// One-time interactive Ocado sign-in.
//
// Opens a real (visible) Chromium window so you can log into Ocado yourself —
// including any 2-factor / captcha — then saves the session cookies to
// .data/ocado-session.json. The app reuses that session headlessly until it
// expires; re-run this script when a comparison says the session has expired.
//
//   npm run ocado:login
//
import { chromium } from "playwright";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";

const SESSION_DIR = path.join(process.cwd(), ".data");
const SESSION_FILE = path.join(SESSION_DIR, "ocado-session.json");

function waitForEnter(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, () => { rl.close(); resolve(); }));
}

async function main() {
  mkdirSync(SESSION_DIR, { recursive: true });

  console.log("\nOpening a browser window…");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    // Reuse an existing session if there is one, so you may already be signed in.
    storageState: existsSync(SESSION_FILE) ? SESSION_FILE : undefined,
    viewport: { width: 1280, height: 900 },
    locale: "en-GB",
  });
  const page = await context.newPage();
  await page.goto("https://www.ocado.com/", { waitUntil: "domcontentloaded" });

  console.log(
    [
      "",
      "  1. In the browser window that just opened, sign in to Ocado.",
      "  2. Make sure you can see your account (you're fully logged in).",
      "  3. Come back here and press Enter to save the session.",
      "",
    ].join("\n"),
  );

  await waitForEnter("Press Enter once you are logged in… ");

  await context.storageState({ path: SESSION_FILE });
  await browser.close();
  console.log(`\nSaved session to ${SESSION_FILE}`);
  console.log("You can now run a live comparison in the app.\n");
}

main().catch((err) => {
  console.error("\nLogin helper failed:", err);
  process.exit(1);
});
