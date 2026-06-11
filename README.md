# Basket Compare

A mobile-friendly PWA that compares your **Ocado basket** against **Amazon UK (Prime)**
prices, so you stop manually checking items one by one.

It fetches your live Ocado trolley, searches Amazon for each item, matches them
(fuzzy title + brand + size), and compares **like-for-like by unit price**
(£/100g, £/100ml, or each) — then shows total potential savings, sorted biggest-first.

Designed to **self-host at home** (always-on PC / Raspberry Pi) with **Apify** for
Amazon data, keeping running cost at roughly **£0/month** and your Ocado credentials
on your own hardware.

## Features

- 📲 **Mobile-first PWA** — installable to your phone home screen, works over your
  home network or Tailscale.
- ⚖️ **Unit-price comparison** — fairly compares a 6×330ml multipack against a 24-pack.
- ⭐ **Watchlist** — star "certain items" and compare just those, or the whole basket.
- 🔧 **Fix match** — wrong match? Pick the right Amazon product; the choice is
  remembered for next time (Ocado SKU → ASIN mapping).
- 🔒 **Credentials encrypted at rest** (AES-256-GCM); Amazon results cached to stay
  inside Apify's free credits.
- 🧪 **Mock mode** by default — runs against realistic fixtures with no external calls.

## Quick start (mock mode)

```bash
npm install
cp .env.example .env
# set ENCRYPTION_KEY in .env:  openssl rand -hex 32
npx prisma db push          # create the SQLite database
npm run dev                  # http://localhost:3000
```

Open the app and tap **Compare basket** — it runs against the bundled fixture basket.

## Going live (real Ocado + Amazon)

1. **Apify**: create a free account, copy your API token into `APIFY_TOKEN` in `.env`.
   (Default actor is `junglee/amazon-crawler`; override with `APIFY_ACTOR_ID`.)
2. Set `PROVIDERS_MODE="live"` in `.env`.
3. Install the Playwright browser: `npx playwright install chromium`.
4. Start the app, go to **Settings**, and save your Ocado email + password.
5. **Verify the Ocado selectors.** Ocado is a single-page app and its markup changes.
   All selectors live in one place — `src/providers/ocado/OcadoBasketProvider.ts`
   (the `OCADO.selectors` object). On first run, if the basket comes back empty,
   open Ocado in your browser's DevTools and update those selectors to match.
6. If Ocado challenges login with a captcha/MFA, the app surfaces a
   "needs manual sign-in" message rather than retrying — sign in manually and
   retry later (the session cookie is reused from `.data/ocado-session.json`).

### Optional: password-protect the app

Set `APP_PASSWORD` in `.env`. A signed-cookie login then gates everything. Leave it
unset on a trusted home network.

## Useful commands

```bash
npm run dev          # dev server
npm run build        # production build
npm run start        # production server
npm test             # unit tests (matching engine)
npm run test:watch   # tests in watch mode
node scripts/generate-icons.mjs   # regenerate PWA icons
```

## How it works

```
Ocado basket ─┐
              ├─► normalise → CanonicalItem (integer pence, base units g/ml/each)
Amazon search ┘                    │
                                   ▼
              matcher (fuzzy title + brand + size, Prime-only)
                                   │
                                   ▼
              savings (unit price preferred, pack-price fallback)
                                   │
                                   ▼
                       ComparisonReport → mobile UI
```

| Area | Path |
| --- | --- |
| Types | `src/types/canonical.ts` |
| Size parsing & unit price | `src/matching/sizeParser.ts` |
| Matching & scoring | `src/matching/matcher.ts` |
| Savings calculation | `src/matching/savings.ts` |
| Providers (mock + live) | `src/providers/` |
| Comparison pipeline | `src/lib/compare.ts` |
| API routes | `src/app/api/` |
| Mobile UI | `src/app/`, `src/components/` |

## Caveats

- Automating Ocado login is likely against their terms of service. This tool is
  intended for **personal, low-volume use** on your own account only.
- Amazon listings vary (third-party sellers, pack sizes, used items). The matcher
  only considers Prime-eligible offers and flags low-confidence matches; always
  sanity-check a match before buying. Use **Fix match** to correct and teach it.
