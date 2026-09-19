# Runway Systems storefront repository

This repository contains the production-oriented Runway Systems storefront: a
React application and Cloudflare backend for selling a suite of Google Sheets
products with one-time Lemon Squeezy payments.

## Repository layout

```text
Runwaysystems-V1/
└── cashflow-os/               Runnable application
    ├── docs/
    │   └── workflow-templates/ Inactive CI, backup, and uptime templates
    ├── src/
    │   ├── api/               Worker API client and preview adapter
    │   ├── components/        Storefront, checkout, auth, and shared UI
    │   ├── context/           Supabase authentication context
    │   ├── data/              Catalog defaults and public policy copy
    │   ├── hooks/             Checkout, public config, and UI hooks
    │   ├── lib/               Supabase and browser utilities
    │   └── pages/             Storefront, product, account, feedback, and admin pages
    ├── functions/             Cloudflare Pages health and SEO upstream proxies
    ├── public/                Static images, security headers, and routing rules
    ├── scripts/               Deployment, sitemap, and local Worker tooling
    ├── tests/                 Frontend and local Worker regression suites
    ├── worker/
    │   ├── src/index.js       Worker API, auth, D1, webhooks, queues, and cron
    │   ├── migrations/        Ordered D1 migrations (0001 through 0017)
    │   ├── .dev.vars.example  Safe local Worker configuration template
    │   └── wrangler.toml      Worker bindings and scheduled triggers
    ├── README.md              Setup and feature guide
    ├── DEPLOYMENT.md          Production deployment runbook
    ├── RECOVERY.md            Restore and continuity runbook
    └── SECURITY.md            Security model and operational controls
```

## Local development

Node.js 22 or newer is required.

```bash
cd cashflow-os
npm ci
cp .env.example .env.local    # fill public local values as needed
npm run dev
```

The frontend has a preview adapter when no production API is configured. For a
real local Worker and D1 regression environment, copy safe values from
`worker/.dev.vars.example` into the ignored `worker/.dev.vars`, then run:

```bash
./scripts/test-worker-local.sh
```

For manual Worker development:

```bash
npx wrangler d1 migrations apply cashflow-os-platform --local --config worker/wrangler.toml
npx wrangler dev --port 8787 --config worker/wrangler.toml
```

## Validation

```bash
npm run check:worker
npm test
npm run build
npm audit --audit-level=high
./scripts/test-worker-local.sh
```

`npm test` includes a Playwright browser regression and therefore needs the
matching Chromium binary (`npx playwright install chromium`). The preserved CI
workflow template installs it automatically after that template is activated.

## Deployment

```bash
cd cashflow-os
./scripts/deploy.sh --check    # read-only preflight
./scripts/deploy.sh            # D1 migrations, Worker, R2, build, and Pages
```

Do not deploy from guessed URLs or placeholder environment values. Follow
`DEPLOYMENT.md` for the complete variables, Worker-only secret inventory,
provider setup, and post-deployment checks. Backups contain customer data and
are written only to the configured private R2 backup bucket; they are not
uploaded as GitHub Actions artifacts.

## Security

See `SECURITY.md` before configuring production. Never commit `.env.local`,
`worker/.dev.vars`, API keys, service-role keys, TOTP material, delivery URLs,
or exported databases. If a secret enters Git history, rotate it immediately;
removing it in a later commit does not make the old value safe.
