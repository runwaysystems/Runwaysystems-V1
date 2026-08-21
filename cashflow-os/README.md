# Runway Systems product suite storefront

Production-oriented React and Vite storefront for the **Runway Systems** suite, with a Cloudflare Worker and D1 backend.

> **Deploying to Cloudflare?** Read `DEPLOYMENT.md` and run `./scripts/deploy.sh --check` — it covers Pages, Workers, D1, R2, secrets, and the Lemon Squeezy webhook in order.

## What is included

- Suite homepage with a real-time 3D runway hero background: a glowing perspective grid with streaming centerline lights, edge lights, and gold particles, with pointer parallax, palette-aware colors, reduced-motion and no-WebGL fallbacks, and a product catalog plus one premium landing page per product (`/products/:key`)
- Cookie and storage consent banner: essential storefront storage and anonymous page counts stay on, while the optional Trustpilot widget only loads after acceptance, with a footer Cookie preferences link to change the choice anytime
- Content studio in the owner dashboard: every storefront text is editable without a deploy - suite homepage copy, per-product marketing content (hero, ticker, problem/solution, tour, features, steps, benefits, audiences, pricing, FAQs, final CTA), per-product and homepage SEO metadata, legal policies, support email, the Trustpilot business unit ID, and a Site copy tab covering the footer brand lines, cart labels, checkout and success wording, sign-in modal, 404 page, and navigation buttons
- Multi-product cart (`/cart`): add products from the catalog or product pages, buy the complete suite in one click, and check out each product with its own secure Lemon Squeezy payment
- Lemon Squeezy payments as the merchant of record: hosted checkout with signed order webhooks, refund revocation, and per-product variant IDs set in the admin panel; every cart pays once, with multi-product carts bundled into a single custom-priced suite bundle (Lemon Squeezy handles global sales tax, including India GST, and remittance)
- Full SEO for present and future products: per-page metadata, canonical URLs, Open Graph and Twitter cards, JSON-LD structured data (Organization, WebSite, Product, FAQPage, BreadcrumbList), static and dynamic sitemaps, robots.txt, and noindex on private routes
- Four seeded products: Cash Flow OS, Client CRM OS, Project OS, and Invoice OS
- Owner image uploads: hero and feature screenshots processed to sharp WebP, stored in Cloudflare R2, and rendered in clean-fit animated frames
- Unlimited numbered feature showcase: every uploaded feature gets an animated number, a heading, and a subheading; AI image scanning writes the copy automatically when configured, and owners can edit it anytime
- Mobile-first storefront with the approved No. 4 Ledger Fold identity
- Cinematic entrance that plays once per fresh page load and never replays during in-app navigation, with reduced-motion support and clear back paths to the suite from every page
- Eight authentic UHD Google Sheets product screenshots for Cash Flow OS and CSS product mocks for newer products
- Custom Google OAuth interface backed by `@supabase/supabase-js`
- Server-created Lemon Squeezy checkouts, one variant per product
- Lemon Squeezy webhook signature verification and idempotent D1 entitlements
- Dual delivery through Brevo email and an authenticated account library
- Signed, expiring feedback links with purchase ownership checks
- Neutral Trustpilot invitation for every verified buyer
- Private feedback and pending-first on-site testimonial moderation
- Owner-only analytics, settings, catalog editor, integrations, and moderation routes
- Accessible responsive states for loading, errors, authentication, and touch

Every product is **Google Sheets only**. Buyers should not open a product in Excel, Numbers, LibreOffice, or another spreadsheet application.

## Architecture

```text
Browser
  -> Supabase Google OAuth
  -> Cloudflare Worker API
       -> Supabase token validation
       -> Lemon Squeezy checkout and verified webhooks
       -> Cloudflare D1
       -> Brevo transactional email
       -> protected Google Sheets delivery secret
```

The browser contains only public configuration. The Lemon Squeezy API key and webhook secret, Brevo key, the Google Sheets `/copy` URL, rate-limit salt, and feedback signing secret stay in Cloudflare Worker secrets.

## Local storefront

Requirements:

- Node.js 22 or later
- npm

```bash
npm ci
cp .env.example .env
npm run dev
```

The public values in `.env.example` are placeholders. Set:

- `VITE_API_BASE_URL`
- `VITE_SUPPORT_EMAIL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_OWNER_EMAIL`
- Optional public Trustpilot values

Do not add delivery or provider secrets to a `VITE_` variable. Vite compiles every `VITE_` value into browser assets.

## Cloudflare Worker and D1

Worker files:

- `worker/src/index.js`
- `worker/wrangler.toml`
- `worker/migrations/0001_initial.sql`
- `worker/migrations/0002_products.sql`
- `worker/.dev.vars.example`

### 1. Create D1

From the project root:

```bash
npx wrangler d1 create cashflow-os-platform
```

Copy the returned database ID into `worker/wrangler.toml`, replacing `REPLACE_WITH_D1_DATABASE_ID`.

### 2. Apply migrations

Local database:

```bash
npx wrangler d1 migrations apply cashflow-os-platform --local --config worker/wrangler.toml
```

Production database:

```bash
npx wrangler d1 migrations apply cashflow-os-platform --remote --config worker/wrangler.toml
```

The first migration creates purchases (UNIQUE on Lemon Squeezy order identifier plus product key, so one order can grant one entitlement per product), durable refund revocations, delivery and review queues, testimonials, private feedback, settings, webhook idempotency, daily aggregate metrics, and rate-limit records. The second migration adds the products table with the Lemon Squeezy variant ID. The third migration adds the product media columns. The fourth migration adds the product_features table for per-feature headings, subheadings, and ordering. The fifth migration adds the storefront content column. All migrations are safe to re-run.

Checkout works through the cart: `POST /checkout/session` accepts one or more `productKey`s and creates a single Lemon Squeezy checkout. A single product uses its own variant; a multi-product cart becomes one custom-priced suite bundle whose total is the sum of the D1 sale prices (never client input). The payment webhook creates one purchase row, one delivery email, and one review request per product key in the order, splitting the order total across the keys. Refunding the order revokes every entitlement in it.

### 2.5 Product media storage (R2)

Admin image uploads are stored in Cloudflare R2:

```bash
npx wrangler r2 bucket create runway-product-media
```

The bucket binding (`MEDIA`) is already declared in `worker/wrangler.toml`. Local `wrangler dev` emulates R2 automatically; objects persist under `worker/.wrangler/state`.

Upload flow: the admin dashboard processes each image in the browser (decode, resize to a 2000-2560 px long edge, gentle saturation and contrast lift, WebP encode), then POSTs it to `POST /admin/products/:key/upload`. The Worker stores the object under `product-media/<key>/<uuid>.webp`, records the path on the product row, and serves it from `GET /media/<key>/<uuid>.webp` with immutable caching. Uploaded hero images replace the product hero visual.

Feature screenshots have no limit. They are managed through `POST /admin/products/:key/features`, `PATCH /admin/products/:key/features/:id`, and `DELETE /admin/products/:key/features/:id`, and each one carries its own heading, subheading, and position. On the storefront they render as a numbered showcase (01, 02, ...) with count-up number animations, alternating layout, clean object-fit framing, blur-up loading, and a slow cinematic drift, all reduced-motion safe.

### 2.6 AI image scanning for feature copy (optional)

When a feature screenshot is uploaded, the Worker can analyze the image and write the heading and subheading automatically. Two configuration options, both optional:

- Add the Workers AI binding named `AI` to the Worker (Cloudflare dashboard, or a `[ai]` block in `wrangler.toml` on an account with Workers AI).
- Or set the secrets `AI_ACCOUNT_ID` and `AI_API_TOKEN` and let the Worker call the Workers AI REST API with the `@cf/llava-hf/llava-1.5-7b-hf` image-to-text model.

With neither configured, uploads still succeed: `aiAvailable` comes back `false` and the owner writes the heading and subheading in the admin panel. AI results are always editable before publishing, so the model never has the final word.

The owner dashboard surfaces the live state in two places: the **Integrations** panel reports "AI image scanning" as connected or setup, and the product editor's feature showcase shows a matching inline note with instructions for whichever state is active.

### 3. Configure non-secret Worker values

Edit `worker/wrangler.toml`:

- `APP_ORIGIN`: exact deployed storefront origin, with no trailing slash
- `SUPABASE_URL`: public Supabase project URL
- `OWNER_EMAIL`: final owner account email
- `TRUSTPILOT_REVIEW_URL`: final public business review URL
- `EMAIL_FROM_DELIVERY`: verified Brevo sender for delivery email (e.g. `delivery@your-domain.com`)
- `EMAIL_FROM_INFO`: verified Brevo sender for review invitations (e.g. `info@your-domain.com`)
- `SUPPORT_EMAIL`: final public support address

`APP_ORIGIN` can contain a comma-separated allowlist if a controlled staging origin is also needed. Avoid wildcards.

### 4. Add Worker secrets

For local Worker development, copy the example without committing the result:

```bash
cp worker/.dev.vars.example worker/.dev.vars
```

For production, set each secret with Wrangler:

```bash
npx wrangler secret put LEMONSQUEEZY_API_KEY --config worker/wrangler.toml
npx wrangler secret put LEMONSQUEEZY_WEBHOOK_SECRET --config worker/wrangler.toml
npx wrangler secret put SUPABASE_ANON_KEY --config worker/wrangler.toml
npx wrangler secret put BREVO_API_KEY --config worker/wrangler.toml
npx wrangler secret put GOOGLE_SHEETS_COPY_URL --config worker/wrangler.toml
npx wrangler secret put RATE_LIMIT_SALT --config worker/wrangler.toml
npx wrangler secret put FEEDBACK_SIGNING_SECRET --config worker/wrangler.toml
```

Generate distinct random values for `RATE_LIMIT_SALT` and `FEEDBACK_SIGNING_SECRET`, with at least 32 random bytes each. Do not reuse a provider key.

The Sheets secret must be the private Google Sheets `/copy` URL. It is returned only after a valid Supabase bearer token and verified purchase ownership check. It is never shown on the success page.

### 5. Run and deploy the Worker

```bash
npx wrangler dev --config worker/wrangler.toml
npx wrangler deploy --config worker/wrangler.toml
```

After deployment, set the public Worker URL as `VITE_API_BASE_URL`, rebuild the storefront, and test CORS from the deployed site.

### Catalog and offer settings

Every product is a row in the D1 `products` table, seeded on first run with the four suite products. The owner dashboard **Products** tab manages the catalog: name, tagline, category, icon, accent, Lemon Squeezy variant ID, private Google Sheets delivery link, display prices, offer label, includes list, visibility, featured status, sort order, and the uploaded hero and feature screenshots (unlimited, numbered on the storefront).

The legacy settings panel remains the fallback for Cash Flow OS when its product-level fields are empty:

- **Lemon Squeezy payments:** the store ID is set once in Settings; every product carries its own variant ID.
- **What customers see:** `offerActive`, `offerLabel`, `displayOriginalPrice`, and `displaySalePrice` control storefront copy.

The public `/config/public` response returns the active products (key, name, tagline, category, icon, accent, display prices, offer label and state, includes, `checkoutReady`), the Trustpilot review URL, and the neutral review policy. It never exposes `lemonVariantId` or `deliveryUrl`. Turning an offer off hides the offer ribbon and struck-through original price while keeping the current price visible. A product without a Lemon Squeezy variant renders with disabled buy buttons.

Display fields do not query or alter Lemon Squeezy. Before publishing a change, confirm the visible price matches the amount attached to the product's Lemon Squeezy variant.

The Cron Trigger runs every five minutes. It retries delivery email and sends review requests due approximately 72 hours after verified purchase. Private feedback tokens are signed and expire after 30 days. A buyer can create a fresh signed link from the protected account library.

## Lemon Squeezy setup (merchant of record)

Lemon Squeezy is the **merchant of record**: it collects the payment,
calculates and remits all sales tax (including India GST), and pays you
out. This app never builds rate tables - taxes are entirely Lemon
Squeezy's responsibility, which is why the provider suits sellers based
in India.

1. Create a Lemon Squeezy account and a store. Record the store ID.
2. Create each suite product and give each a variant. Record the variant IDs.
3. Paste the store ID into **Admin -> Settings -> Lemon Squeezy payments** and each variant ID into the product's **Lemon Squeezy checkout** section.
4. In Lemon Squeezy Settings -> API, create an API key and copy the webhook signing secret into the Worker secrets `LEMONSQUEEZY_API_KEY` and `LEMONSQUEEZY_WEBHOOK_SECRET`.
5. Add a webhook endpoint at:

```text
https://YOUR_WORKER_DOMAIN/webhooks/lemonsqueezy
```

6. Subscribe to:
   - `order_created`
   - `order_refunded`

The Worker creates checkouts only for authenticated Supabase users. It attaches the user ID and product keys as checkout custom data, verifies the signed order webhook server-side, and writes one entitlement per product key in the paid order. Refunds are recorded durably in `revoked_orders` so a delayed order event cannot restore a revoked entitlement. The success route polls the account library for the new purchase and never returns the product link.

Before launch, use Lemon Squeezy test mode to prove:

- Successful card payment
- Cancelled checkout
- Delayed or replayed webhook
- Duplicate webhook delivery
- Full refund revocation
- Payment success before webhook arrival
- Full refund revokes the account entitlement and cancels any unsent review request
- Brevo delivery retry after a temporary failure without duplicate messages

## Brevo setup

1. Add the production sending domain in Brevo and verify it (DNS records).
2. Publish its SPF and DKIM records (Brevo guides you through both).
3. Wait for domain verification, then confirm the sender addresses used by
   the Worker: `EMAIL_FROM_DELIVERY` (e.g. `delivery@…`) and
   `EMAIL_FROM_INFO` (e.g. `info@…`).
4. Create a transactional (SMTP) API key for this Worker in Brevo.
5. Set the two sender addresses in `worker/wrangler.toml`.
6. Test delivery to Gmail, Outlook, and a custom domain.

Emails are sent through Brevo's transactional API with the HTML built in
code, so no templates need to be created in Brevo.

The payment webhook queues delivery and the Cron Trigger retries failures. Review email is neutral and consistent for every verified buyer. It offers an independent Trustpilot review and a separate private feedback path without rating-based selection.

## Supabase and Google OAuth

1. Create a Supabase project.
2. Enable the Google provider.
3. In Google Cloud, configure the Supabase callback URL shown by the provider, normally:

```text
https://YOUR_PROJECT.supabase.co/auth/v1/callback
```

4. Set the Supabase Site URL to the production storefront origin.
5. Add exact redirect allowlist entries for production and controlled staging origins.
6. Put only the project URL and public anon key in the storefront environment.
7. Configure the same project URL in the Worker and add the anon key as a Worker secret.
8. Set the final owner email in both browser and Worker configuration, or assign `app_metadata.role = owner` through a trusted server-side process.

Owner authorization is repeated by the Worker for every `/admin` endpoint. Browser route protection is convenience only and is not the security boundary.

## Trustpilot setup

The pricing area uses a star-rating TrustBox, not a review carousel. Replace the placeholder Business Unit ID and public review URL when the final Trustpilot profile exists.

Every verified buyer must continue to receive the same neutral invitation, regardless of rating or private feedback. Do not add positive-rating gates, selective invitation logic, or incentives.

## SPA hosting and rewrites

`public/_redirects` is included for hosts that support Netlify-style SPA rewrites:

```text
/* /index.html 200
```

For Cloudflare Pages, deploy the Vite output directory `dist` and confirm direct visits to these routes return the SPA:

- `/account`
- `/success`
- `/feedback`
- `/admin`
- `/terms`

If the chosen host does not use `_redirects`, configure the equivalent fallback to `/index.html` while allowing real assets to pass through.

## API overview

Public or low-risk endpoints:

- `GET /health`
- `GET /config/public`
- `GET /testimonials`
- `POST /events/page-view`
- `POST /webhooks/lemonsqueezy`, verified by Lemon Squeezy HMAC signature

Authenticated buyer endpoints:

- `POST /checkout/session`
- `GET /account/purchases`
- `POST /account/purchases/:purchaseId/delivery`
- `POST /account/purchases/:purchaseId/feedback-link`
- `GET /feedback/access?token=...`
- `POST /feedback`
- `POST /testimonials`

Owner-only endpoints:

- `GET /admin/testimonials`
- `PATCH /admin/testimonials/:id`
- `GET /admin/analytics`
- `GET /admin/settings`
- `PUT /admin/settings`
- `GET /admin/integrations/status`

## Validation

```bash
npm run build
npm run test:regression
npm audit --omit=dev
node --check worker/src/index.js
```

The browser regression covers the Ledger Fold identity, intro and reduced motion, screenshots, responsive layout, approved-only testimonials, protected routes, secure delivery architecture, neutral review policy, and the U+2014 character prohibition.

Apply the migrations to a local D1 binding and start the Worker:

```bash
cp worker/.dev.vars.example worker/.dev.vars
# Replace each value in worker/.dev.vars with safe local test values.
npx wrangler d1 migrations apply cashflow-os-platform --local --config worker/wrangler.toml
# Note: the local apply works in batches; rerun it until every migration
# shows a success status. scripts/test-worker-local.sh does this for you.
npx wrangler dev --local --config worker/wrangler.toml
```

Or run the whole local harness in one command (migrations, mock Supabase
fixture, dev server, cleanup, then the regression suite):

```bash
./scripts/test-worker-local.sh
```

In a second terminal, pass the same safe local webhook signing value to the Worker regression:

```bash
LEMONSQUEEZY_WEBHOOK_SECRET='your-local-test-value' npm run test:worker
```

The Worker regression checks the D1 health path, exact-origin CORS, public configuration exposure, JSON enforcement, unauthenticated route rejection, Lemon Squeezy signature verification and event replay idempotency, Cron execution, telemetry persistence, and sanitized error responses. Delete `worker/.dev.vars` after testing. For a complete pre-launch test, also use Lemon Squeezy test mode, a verified Supabase test user, and a Brevo test recipient to exercise checkout, owner enforcement, email delivery, signed feedback, and refund revocation end to end.

## Operations: CI, monitoring, backups

- **CI**: every push and pull request runs `.github/workflows/ci.yml` -
  storefront build, the jsdom/browser regressions, and the Worker API
  regression against a local D1 with a mock Supabase. No setup required.
- **Error tracking**: storefront crashes and unhandled browser errors are
  reported to `POST /events/client-error` (rate-limited, PII-redacted,
  retained 30 days) and listed in the owner dashboard under **Operations**,
  alongside failed delivery emails with a one-click retry.
- **Uptime**: `.github/workflows/uptime.yml` probes `/health` and the
  storefront every 15 minutes once the `WORKER_HEALTH_URL` and
  `STOREFRONT_URL` repository variables are set; a failed run emails the
  repository watchers.
- **Backups**: `.github/workflows/backup.yml` exports D1 nightly to the R2
  bucket `runway-d1-backups` once `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID` repository secrets are set. Manual dump:
  `./scripts/backup-d1.sh`. Restore steps and incident playbooks live in
  [RECOVERY.md](RECOVERY.md).

## Final launch checklist

- Replace every placeholder domain, email, Supabase value, Lemon Squeezy variant, Trustpilot value, and D1 ID.
- Review the legal copy for the operator's jurisdiction and add final public company contact details.
- Confirm the owner-configured current price matches the amount attached to the Lemon Squeezy variant.
- Confirm disabling the offer hides the ribbon and original-price strikethrough on every storefront surface.
- Confirm sign-in is required before checkout.
- Confirm a successful payment creates exactly one entitlement.
- Confirm email delivery and protected library delivery both work.
- Confirm the Sheets URL is absent from `dist` and all public environment variables.
- Confirm the success page contains no product delivery URL.
- Confirm account A cannot verify or access account B's purchase.
- Confirm feedback links reject invalid signatures, expire, and still require purchase ownership.
- Confirm all testimonials begin pending and only approved entries appear publicly.
- Confirm every verified buyer receives the same Trustpilot invitation.
- Confirm `/admin` returns no data to non-owner accounts.
- Confirm Brevo SPF and DKIM pass.
- Confirm Lemon Squeezy live webhook signatures validate.
- Confirm D1 migrations are applied before Worker deployment.
- Confirm direct SPA routes work on the production host.
- Run build, regression, dependency audit, browser console checks, and a recursive U+2014 scan.

## Brand and product constraints

- Company: **Runway Systems**
- Product: **Cash Flow OS**
- Approved mark: exact original **No. 4 Ledger Fold**
- Fonts: Space Grotesk and IBM Plex Mono
- Default accent: champagne gold
- Product compatibility: Google Sheets only
- Default displayed price: $69 regular, $39 offer; owner-controlled through Worker settings
- U+2014 em dash characters are prohibited throughout the project
