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

Wrangler applies every pending ordered migration in `worker/migrations/`.
These cover core commerce, catalog/content, consent, security and audit data,
telemetry, waitlists, durable marketing delivery, exact checkout correlation,
legacy audit-IP cleanup, exact-email complimentary access, and Runway Systems Blog posts, revisions, media usage, redirects, and publication automation.

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
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config worker/wrangler.toml
npx wrangler secret put BREVO_API_KEY --config worker/wrangler.toml
npx wrangler secret put RATE_LIMIT_SALT --config worker/wrangler.toml
npx wrangler secret put FEEDBACK_SIGNING_SECRET --config worker/wrangler.toml
npx wrangler secret put TOTP_ENCRYPTION_KEY --config worker/wrangler.toml
```

Generate `RATE_LIMIT_SALT`, `FEEDBACK_SIGNING_SECRET`, and `TOTP_ENCRYPTION_KEY` as distinct random strings of at least 32 bytes. `TOTP_ENCRYPTION_KEY` protects both the admin authenticator seed and the retryable encrypted copy of pending complimentary claim tokens; rotating it requires resetting TOTP and resending pending invitations. The Supabase service-role key is required for fail-closed webhook ownership verification and must remain Worker-only.

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
| `VITE_API_BASE_URL` | **Required.** Exact Worker URL for this environment, e.g. `https://cashflow-os-platform.YOUR_SUBDOMAIN.workers.dev`. The browser API, first-response Blog renderer, RSS, sitemap, and LLM discovery proxies use it; there is no cross-environment production fallback. |
| `JOURNAL_SOURCE_URL` | Optional Pages runtime override for the same Worker base URL. Use only if first-response Blog rendering should read a different controlled API deployment. |
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
> or anywhere client-side. It is required only as a secret on the Worker for webhook ownership checks.

### 3.2 Build settings

| Setting | Value |
|---|---|
| Production branch | `main` (or the branch you deploy from) |
| Root directory | `cashflow-os` |
| Build command | `npm ci && npm run build` |
| Build output | `dist` |

Vite treats `CF_PAGES=1` (set automatically by Cloudflare Pages) as a strict
production build. It refuses missing, localhost, placeholder, or non-HTTPS API
and Supabase URLs; it also rejects secret-shaped `VITE_` names. Direct-upload
builds run by `scripts/deploy.sh` set the equivalent
`RUNWAY_PRODUCTION_BUILD=1` guard. Plain `npm run dev` and local validation
builds remain usable without production credentials.

### 3.3 Deploy

```bash
npx wrangler pages project create runway-systems-storefront --production-branch main   # once
npx wrangler pages deploy dist --project-name runway-systems-storefront
```

`public/_redirects` uses route-specific SPA rewrites to `/app-shell`, a build
copy of `index.html`. This avoids Cloudflare's `/index.html` normalization loop
while keeping real SEO and status files reachable. Git and Wrangler deploys
from the project root also include Pages Functions for `/sitemap.xml`,
`/robots.txt`, and `/health`; dashboard `dist/` drag-and-drop still serves the
generated static sitemap and robots files. After deploy, verify client routes
(for example `/terms` and `/products/cashflow-os`) and machine-readable URLs
(`/sitemap.xml`, `/robots.txt`, `/health`) return the expected content.

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
- [ ] **Admin → Blog** creates a private AI-import draft, saves visual and
      Markdown edits, manages categories/media, previews all four layouts,
      and publishes or schedules without a storefront deployment
- [ ] A published Blog article returns semantic first-response HTML at its
      stable `/blog/:slug` URL and appears in `/sitemap.xml`, `/blog/feed.xml`,
      `/llms.txt`, and `/llms-full.txt`; drafts and future schedules do not
- [ ] Blog image upload accepts a real PNG/JPEG/WebP, requires useful alt
      text before publication, and refuses deletion while the image is in use
- [ ] The signup section above the original-design site footer returns a generic
      pending response, sends a Brevo confirmation link with a fragment token,
      requires the explicit POST confirmation, rejects replay, enters the
      consented lead audience, and unsubscribes through the existing one-time
      suppression flow
- [ ] Newsletter signup appears on the homepage, product pages, Blog index, and
      published articles only—not cart, account, claim, confirmation, admin,
      legal, or error contexts; `/newsletter/confirm` is noindex,
      excluded from the sitemap, and disallowed in robots
- [ ] **Admin → Integrations** shows Lemon Squeezy, Supabase, Brevo, and
      Trustpilot connected (and AI if configured)
- [ ] **Admin → Products** has Lemon Squeezy variant IDs and delivery links
      per product
- [ ] Test purchase in Lemon Squeezy test mode: checkout, success page,
      account library, delivery email, refund revocation
- [ ] Multi-product cart checkout grants one entitlement per product
- [ ] **Admin → Complimentary access** sends a claim-only email with no Sheets
      URL; the wrong Google email is rejected, the exact email receives all
      selected products, replay fails, and paid sales/revenue stay unchanged
- [ ] Cookie banner gates the Trustpilot widget until acceptance
- [ ] Upload a feature screenshot; check the media URL serves and (with AI
      configured) the heading was auto-written
- [ ] Supabase's redirect allowlist contains the exact production `/account`
      and `/claim` URLs (plus only controlled staging equivalents)
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
  every public route. Google renders the JavaScript, so pages for products
  created later in the admin panel are crawlable without redeploys.
- **Sitemaps:** `npm run build` writes `dist/sitemap.xml` and
  `dist/robots.txt` for every code-defined route. Keep that generated XML in
  the build so `/sitemap.xml` can fall back to real XML instead of the React
  404 page. The Worker also serves a dynamic `/sitemap.xml` that includes
  active products and published Blog articles with `lastmod` while omitting hidden products and every private Blog state;
  `functions/sitemap.xml.js` exposes that Worker-backed XML on the
  storefront host via `SITEMAP_SOURCE_URL` or `VITE_API_BASE_URL`, and falls
  back to the static file if no source is configured or the Worker is
  unavailable. Do not use a `public/_redirects` `200` rule to proxy the external
  Worker URL: Cloudflare Pages only supports `200` proxy rewrites to relative
  paths.
- **Blog first response:** `functions/blog/[slug].js` fetches only the Worker's published projection and emits semantic article HTML, canonical/social metadata, RSS discovery, and BlogPosting/Breadcrumb JSON-LD before React boots. Confirm direct article requests return 200, old slugs return 308, private slugs return 404 with `X-Robots-Tag: noindex`, and an unreachable Worker returns 503.
- **Discovery:** Pages proxies `/blog/feed.xml`, `/llms.txt`, and `/llms-full.txt` to the dynamic Worker outputs. These files list published records only; `llms.txt` is an emerging convention and does not guarantee indexing, citation, or ranking.
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
| SEO / routing artifacts | `dist/sitemap.xml`, `dist/robots.txt`, `dist/app-shell.html` (generated at build), `public/_redirects`, `public/_routes.json`, `functions/sitemap.xml.js`, `functions/robots.txt.js`, `functions/health.js`, `src/components/Seo.jsx`, `scripts/generate-sitemap.mjs` |
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

---

## 7. Backups, uptime monitoring and CI

Deployment is only half of running the platform. After the first deploy,
finish the operational setup too:

**CI (activation required).** Copy `docs/workflow-templates/ci.yml` to
`.github/workflows/ci.yml` using an account with workflow write permission.
Once active, every push and pull request runs the storefront build, jsdom and
browser regressions, and the full Worker API regression against a local D1 and
mock Supabase. A red CI run means do not deploy.

**Nightly database backups (activation required).** Copy
`docs/workflow-templates/backup.yml` to `.github/workflows/backup.yml`, then arm
it with repository secrets `CLOUDFLARE_API_TOKEN` (D1 read/export and R2 edit
access) and `CLOUDFLARE_ACCOUNT_ID`, plus repository variable
`CLOUDFLARE_BACKUP_BUCKET`. Once active, it exports D1 every night into a
private R2 bucket. The workflow fails visibly when configuration is missing and
does not copy customer data into GitHub artifacts. A manual dump is available
with `./scripts/backup-d1.sh --bucket YOUR_PRIVATE_BUCKET`.

**Uptime monitoring (activation required).** Copy
`docs/workflow-templates/uptime.yml` to `.github/workflows/uptime.yml`, then set
repository variables `PLATFORM_HEALTH_URL` and `STOREFRONT_HEALTH_URL` to their
complete `/health` URLs. Once active, it probes both JSON health endpoints every
10 minutes; GitHub emails repository watchers when it fails. GitHub scheduled
runs can lag under load, so for paging-grade alerts also point a dedicated
monitor (UptimeRobot, Better Stack) at `/health`.

**Full restore and incident playbooks**: see [RECOVERY.md](RECOVERY.md).
