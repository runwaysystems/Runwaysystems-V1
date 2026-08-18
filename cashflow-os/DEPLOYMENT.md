# Deploying to Cloudflare

This suite ships as two Cloudflare services that talk to each other:

```text
Cloudflare Pages                     Cloudflare Workers
  (storefront: React + Vite)           (platform API)
       │  calls /config/public,             │  D1 database (products, purchases,
       │  checkout, account, ...            │    features, testimonials, settings)
       │  ───────────────────────────▶     │  R2 bucket (uploaded product media)
       │                                   │  Workers AI (optional image scanning)
       │                                   │  Lemon Squeezy webhooks,
       │                                   │  Supabase auth, Brevo email
```

- **Pages** serves the frontend (the `dist/` folder).
- **Workers** runs `worker/src/index.js` with a D1 database, an R2 media
  bucket, and secrets for Lemon Squeezy, Supabase, Brevo, and delivery links.

Everything below can be done with the dashboard or the CLI. A one-command
script is included: `./scripts/deploy.sh` (see the bottom of this file).

---

## 1. One-time prerequisites

1. **Cloudflare account** with Workers and Pages enabled.
2. **CLI login** (skip if you deploy from the dashboard only):
   ```bash
   npm ci
   npx wrangler login
   ```
3. **Lemon Squeezy account** with a store, **Supabase project** with
   Google OAuth, and a **Brevo** sending domain. You need each product's
   Google Sheets template shared as a `/copy` link.

---

## 2. Deploy the Worker (API)

### 2.1 Create the D1 database

```bash
npx wrangler d1 create cashflow-os-platform
```

Copy the returned `database_id` into `worker/wrangler.toml` (replacing
`REPLACE_WITH_D1_DATABASE_ID`).

### 2.2 Create the R2 media bucket

```bash
npx wrangler r2 bucket create runway-product-media
```

### 2.3 Apply the D1 migrations

```bash
npx wrangler d1 migrations apply cashflow-os-platform --remote --config worker/wrangler.toml
```

Five migrations run: core tables with Lemon Squeezy order identifiers,
products with variant IDs, media columns, feature details, and the content
studio.

### 2.4 Configure Worker variables and secrets

Edit `worker/wrangler.toml` for non-secret values:

| Variable | Value |
|---|---|
| `APP_ORIGIN` | Final storefront origin, e.g. `https://runway-systems.pages.dev` (comma-separated allowlist allowed, no trailing slash) |
| `SUPABASE_URL` | Your Supabase project URL |
| `OWNER_EMAIL` | Your admin account email |
| `TRUSTPILOT_REVIEW_URL` | Public Trustpilot review URL |
| `EMAIL_FROM_DELIVERY` | Verified Brevo sender for delivery email, e.g. `delivery@your-domain.com` |
| `EMAIL_FROM_INFO` | Verified Brevo sender for review invitations, e.g. `info@your-domain.com` |
| `SUPPORT_EMAIL` | Public support address |

Then set secrets (never commit these):

```bash
npx wrangler secret put LEMONSQUEEZY_API_KEY --config worker/wrangler.toml
npx wrangler secret put LEMONSQUEEZY_WEBHOOK_SECRET --config worker/wrangler.toml
npx wrangler secret put SUPABASE_ANON_KEY --config worker/wrangler.toml
npx wrangler secret put BREVO_API_KEY --config worker/wrangler.toml
npx wrangler secret put GOOGLE_SHEETS_COPY_URL --config worker/wrangler.toml
npx wrangler secret put RATE_LIMIT_SALT --config worker/wrangler.toml
npx wrangler secret put FEEDBACK_SIGNING_SECRET --config worker/wrangler.toml
```

Generate `RATE_LIMIT_SALT` and `FEEDBACK_SIGNING_SECRET` as random strings
of at least 32 bytes.

**Optional: AI image scanning.** In the Cloudflare dashboard, open the
Worker, go to **Settings → Bindings → Add**, and add a **Workers AI**
binding named `AI`. Without it (or the optional `AI_ACCOUNT_ID` +
`AI_API_TOKEN` secrets), feature uploads work but the owner writes the
headings by hand. Do not add an `[ai]` block to `wrangler.toml` unless your
local machine is authenticated with Cloudflare: it breaks local
`wrangler dev`.

### 2.5 Deploy

```bash
npx wrangler deploy --config worker/wrangler.toml
```

### 2.6 Lemon Squeezy webhook

In Lemon Squeezy → Settings → Webhooks, add an endpoint pointing at:

```text
https://YOUR_WORKER_DOMAIN/webhooks/lemonsqueezy
```

Subscribe to `order_created` and `order_refunded`. The signing secret goes
into `LEMONSQUEEZY_WEBHOOK_SECRET` (step 2.4).

---

## 3. Deploy the storefront (Pages)

### 3.1 Build-time environment variables

Create the Pages project (dashboard or CLI) and set these **environment
variables** (they are compiled into the frontend at build time):

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | Worker URL, e.g. `https://cashflow-os-platform.YOUR_SUBDOMAIN.workers.dev` |
| `VITE_SUPPORT_EMAIL` | Public support address |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key (public by design; see the RLS requirement below) |
| `VITE_OWNER_EMAIL` | Optional. Compiled into the browser bundle, so visible to anyone who inspects the JS; prefer setting the owner role in Supabase `app_metadata` and leave this empty |
| `VITE_TRUSTPILOT_REVIEW_URL` | Public Trustpilot review URL |
| `VITE_TRUSTPILOT_BUSINESS_UNIT_ID` | Optional, enables the Trustpilot TrustBox |

> **Supabase anon key + Row Level Security.** The anon key is safe to ship
> in the bundle only because this storefront uses Supabase for
> authentication and never queries Supabase tables from the browser (all
> data lives in D1, accessed through the Worker). If you ever add
> client-side Supabase reads, enable Row Level Security on every Supabase
> table first. The service_role key must never appear in a `VITE_` variable
> or anywhere client-side — it never needs to be set at all for this app.

### 3.2 Build settings

| Setting | Value |
|---|---|
| Production branch | `main` (or the branch you deploy from) |
| Root directory | `cashflow-os` |
| Build command | `npm ci && npm run build` |
| Build output | `dist` |

### 3.3 Deploy

```bash
npx wrangler pages project create runway-systems-storefront --production-branch main   # once
npx wrangler pages deploy dist --project-name runway-systems-storefront
```

The SPA router needs the rewrite already included in
`public/_redirects` (`/* /index.html 200`).

---

## 3.5 Lemon Squeezy payments (the merchant of record)

Lemon Squeezy is the **merchant of record**: it collects payment, handles
global sales tax (including India GST) collection and remittance, and pays
you out. This is why the platform suits sellers based in India: no
separate tax registration is needed on your side.

1. Create a Lemon Squeezy account and a **store**. Copy the store ID.
2. Create each product (Cash Flow OS, Client CRM OS, Project OS, Invoice
   OS) and give each product a **variant**. Copy each variant ID.
3. Lemon Squeezy → Settings → API: create an **API key** and copy the
   **webhook signing secret**.
4. Add the secrets to the Worker (step 2.4).
5. In the admin panel → Settings → **Lemon Squeezy payments**, paste the
   store ID. In Products → **Lemon Squeezy checkout**, paste each
   product's variant ID. Optionally create a "Runway Systems Suite
   Bundle" product in Lemon Squeezy and paste its variant ID into
   **Bundle variant ID** so multi-product receipts read as a bundle.
6. Add the webhook endpoint in Lemon Squeezy (step 2.6) and subscribe to
   `order_created` and `order_refunded`.
7. Every cart checks out with ONE payment. A single product uses its own
   variant; a multi-product cart becomes one custom-priced "Runway
   Systems Suite Bundle" checkout whose total is the sum of the D1 sale
   prices, with each product listed in the description. The paid webhook
   grants every product key in the order. Taxes are handled entirely by
   Lemon Squeezy; the checkout redirect returns buyers to /success.

## 4. Post-deploy verification checklist

- [ ] `https://STORE.workers.dev/health` returns `{"ok":true,"ready":true,"missing":[]}` - a 503 here means critical config is missing (the response lists which)
- [ ] `/config/public` on the Worker returns the product list
- [ ] Worker responses carry the security headers (nosniff, `X-Frame-Options: DENY`, HSTS, CSP) and an `X-Correlation-Id` - check the Network tab in devtools
- [ ] Storefront loads, intro plays once, products and cart work
- [ ] **Admin → Content studio** loads and lets you edit suite copy, a
      product's marketing content, and the legal policies; saving one flows
      to the public storefront within the config cache window (60s)
- [ ] **Admin → Integrations** shows Lemon Squeezy, Supabase, Brevo, and
      Trustpilot connected (and AI if configured)
- [ ] **Admin → Products** has Lemon Squeezy variant IDs and delivery links
      per product
- [ ] Test purchase in Lemon Squeezy test mode: checkout, success page,
      account library, delivery email, refund revocation
- [ ] Multi-product cart checkout grants one entitlement per product
- [ ] Cookie banner gates the Trustpilot widget until acceptance
- [ ] Upload a feature screenshot; check the media URL serves and (with AI
      configured) the heading was auto-written
- [ ] **Supabase rate limits**: this app has no login, OTP, or password-reset
      endpoints of its own (Google OAuth via Supabase). Enable rate limits on
      those flows in Supabase's dashboard, since only Supabase can throttle
      them.
- [ ] If you serve the storefront or Worker from a custom domain, add that
      domain to `connect-src` in `public/_headers` (the template allows
      `*.workers.dev` and `*.supabase.co`).

---

## 4.5 SEO for present and future products

The storefront ships with full SEO out of the box:

- **Per-page metadata** (title, description, canonical, Open Graph, Twitter
  cards) and **JSON-LD structured data** (Organization, WebSite, Product
  with Offer, BreadcrumbList, FAQPage) are rendered by the Seo component on
  every route. Google renders the JavaScript, so pages for products created
  later in the admin panel are fully crawlable without redeploys.
- **Sitemaps:** `npm run build` writes `dist/sitemap.xml` and
  `dist/robots.txt` for every code-defined route. The Worker also serves a
  dynamic `/sitemap.xml` that includes products created in the admin panel.
  To put the dynamic sitemap on your storefront hostname, add one line to
  `public/_redirects` (template included) proxying `/sitemap.xml` to your
  deployed Worker, then rebuild and redeploy.
- **Build domain:** set `SITE_URL=https://your-domain.com` when building so
  the static sitemap and canonical URLs use your production domain.
- **Crawl hygiene:** /account, /feedback, /admin, /success, /cart, and the
  404 page are noindex; unknown URLs return a distinct 404 page instead of
  duplicating the homepage.
- **Verification:** submit both sitemaps in Google Search Console after
  launch and keep the Pages deployment URL or your custom domain as the
  canonical property.

## 5. The files that matter for deployment

| Purpose | Files |
|---|---|
| Storefront source | `cashflow-os/src/**`, `cashflow-os/index.html`, `cashflow-os/vite.config.js` |
| Storefront assets | `cashflow-os/public/**` (UHD screenshots, favicon, `_redirects`) |
| Dependencies | `cashflow-os/package.json`, `cashflow-os/package-lock.json` |
| Worker | `cashflow-os/worker/src/index.js`, `cashflow-os/worker/wrangler.toml` |
| Database schema | `cashflow-os/worker/migrations/*.sql` (applied automatically, in order) |
| SEO artifacts | `dist/sitemap.xml`, `dist/robots.txt` (generated at build), `public/_redirects`, `src/components/Seo.jsx`, `scripts/generate-sitemap.mjs` |
| Deployment | `cashflow-os/scripts/deploy.sh`, this guide |

Everything else (`tests/`, `reference/`, `README`s) is development or
reference material and is not deployed.

---

## 6. One-command deployment

```bash
cd cashflow-os
./scripts/deploy.sh --check     # pre-flight: nothing is changed, shows what is missing
./scripts/deploy.sh             # full deploy: build, R2 bucket, migrations, Worker, Pages
./scripts/deploy.sh --worker    # Worker + database + bucket only
./scripts/deploy.sh --pages     # storefront only
```

The script uses the `CLOUDFLARE_API_TOKEN` environment variable if present,
otherwise your existing `wrangler login` session. Set `PAGES_PROJECT` to
override the Pages project name (default `runway-systems-storefront`).
