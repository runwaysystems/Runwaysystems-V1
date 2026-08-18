# Systems-web

Multi-product storefront for **Runway Systems**: a suite of Google Sheets products for independent businesses, sold with one-time payments.

## Repository layout

```text
Systems-web/
├── cashflow-os/              The runnable application (frontend + backend)
│   ├── src/                  React + Vite storefront source
│   │   ├── api/              Worker API client with a localStorage preview adapter
│   │   ├── components/       Shared UI: shell, sections, mocks, auth, branding
│   │   ├── context/          Supabase auth provider
│   │   ├── data/             Product marketing catalog and view-model builder
│   │   ├── hooks/            Checkout, public config, page animations
│   │   ├── lib/              Supabase client, image processing, intro state
│   │   └── pages/            Catalog home, product pages, account, feedback, admin
│   ├── public/               UHD product screenshots, favicon, redirects
│   ├── tests/                Regression suites and browser-simulation diagnostics
│   │   ├── ledger-fold-regression.mjs     Playwright browser regression
│   │   ├── worker-local-regression.mjs    Worker API regression (local D1/R2)
│   │   ├── browser-boot-check.mjs         Module graph evaluation in jsdom
│   │   ├── browser-render-check.mjs       Full app mount in jsdom
│   │   └── mock-supabase.mjs              Local auth mock for worker tests
│   └── worker/               Cloudflare Worker backend
│       ├── src/index.js      API, Lemon Squeezy webhooks, media uploads, AI image scan
│       ├── migrations/       D1 migrations (0001 initial ... 0005 content)
│       └── wrangler.toml     Worker config, D1 and R2 bindings, cron trigger
└── reference/                Design and source material (not part of the app)
    ├── design/               Logo atlas and ledger fold explorations
    ├── source/               Original screenshot sources and the showcase reference image
    └── PRODUCTION_VALIDATION_REPORT.md   Historical validation report
```

## Running locally

```bash
cd cashflow-os
npm ci
npm run dev          # dev server with hot reload
npm run build        # production bundle into dist/
npm run preview      # serve the production bundle
```

Worker (from `cashflow-os/`):

```bash
npx wrangler d1 migrations apply cashflow-os-platform --local --config worker/wrangler.toml
npx wrangler dev --port 8787 --config worker/wrangler.toml
```

## Deploying to Cloudflare

```bash
cd cashflow-os
./scripts/deploy.sh --check    # pre-flight: shows what is missing, changes nothing
./scripts/deploy.sh            # full deploy: storefront (Pages) + Worker + D1 + R2
```

The full step-by-step guide, environment-variable tables, secrets list, and
post-deploy checklist live in `cashflow-os/DEPLOYMENT.md`.

See `cashflow-os/README.md` for the full setup, product-management, and
feature guide.

## Security

See `SECURITY.md` for the secret-safety rules and the full audit table.

**Git history warning:** the last full secret audit found no hardcoded
secrets in this repository's history (all values are placeholders or
environment references). If a secret is ever committed in the future, treat
it as permanently compromised: **rotate it immediately** at the provider —
deleting it from the file is not enough, because the value remains in git
history.

