# START HERE — Runway Systems storefront + platform (Cloudflare deploy)

You are holding the complete deployable package for **Runway Systems**.
It contains a React storefront, a Cloudflare Workers platform API (D1 +
R2), and everything the owner manages from the admin panel (products,
pricing, content, offers, reviews, payment provider).

Payments run on **Lemon Squeezy as the merchant of record**: Lemon
Squeezy collects the payment, calculates and remits all sales tax
(including India GST), and pays you out. This is the only payment
provider in the codebase.

## What is in this folder

```text
cashflow-os/                  The whole app
  src/                        Storefront React app (Vite)
  worker/                     Cloudflare Worker (platform API) + D1 migrations
  public/                     _redirects, _headers, favicon, SEO robots/sitemap
  tests/                      Regression suites (worker + browser)
  scripts/deploy.sh           One-command deploy script
  package.json / package-lock.json
DEPLOYMENT.md                 Full step-by-step deploy guide (read it)
README.md                     Feature + architecture overview
SECURITY.md                   Security policy, threat model, data map
START-HERE.md                 This file
```

## Pick your deploy path

| Path | Best for | Time |
|---|---|---|
| **A. Connect to Git** (recommended) | You already have the repo on GitHub | ~20 min, then automatic deploys |
| B. Wrangler CLI | You prefer the terminal | ~25 min |
| C. Cloudflare dashboard upload | No Git, no CLI | ~30 min |

Full instructions for all three are in **DEPLOYMENT.md**. The short
version:

### 1. Accounts you need

- **Cloudflare** (Workers + Pages enabled)
- **Supabase** project with Google OAuth (buyer sign-in)
- **Resend** sending domain (delivery emails)
- **Lemon Squeezy** account with a store

### 2. Deploy the Worker (platform API)

1. `npx wrangler d1 create cashflow-os-platform` and put the returned
   `database_id` into `cashflow-os/worker/wrangler.toml`.
2. `npx wrangler r2 bucket create runway-product-media`.
3. Apply migrations:
   `npx wrangler d1 migrations apply cashflow-os-platform --remote --config cashflow-os/worker/wrangler.toml`
4. Set the non-secret variables in `worker/wrangler.toml`
   (`APP_ORIGIN`, `SUPABASE_URL`, `OWNER_EMAIL`, `SUPPORT_EMAIL`, ...).
5. Set secrets:

   ```bash
   npx wrangler secret put LEMONSQUEEZY_API_KEY --config worker/wrangler.toml
   npx wrangler secret put LEMONSQUEEZY_WEBHOOK_SECRET --config worker/wrangler.toml
   npx wrangler secret put SUPABASE_ANON_KEY --config worker/wrangler.toml
   npx wrangler secret put RESEND_API_KEY --config worker/wrangler.toml
   npx wrangler secret put GOOGLE_SHEETS_COPY_URL --config worker/wrangler.toml
   npx wrangler secret put RATE_LIMIT_SALT --config worker/wrangler.toml
   npx wrangler secret put FEEDBACK_SIGNING_SECRET --config worker/wrangler.toml
   ```

6. `npx wrangler deploy --config worker/wrangler.toml`
7. In Lemon Squeezy → Settings → Webhooks, add the endpoint
   `https://YOUR_WORKER_DOMAIN/webhooks/lemonsqueezy` and subscribe to
   `order_created` and `order_refunded`.

### 3. Deploy the storefront (Pages)

1. Build env vars: `VITE_API_BASE_URL` (your Worker URL),
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `VITE_SUPPORT_EMAIL`, and optionally `VITE_TRUSTPILOT_REVIEW_URL` /
   `VITE_TRUSTPILOT_BUSINESS_UNIT_ID`.
2. Build: root directory `cashflow-os`, command `npm ci && npm run build`,
   output `dist`. For the SEO sitemap and canonicals, also set
   `SITE_URL=https://your-domain.com`.
3. Deploy `dist/` (dashboard drag-and-drop, `wrangler pages deploy`, or
   Git integration on the `main` branch).
4. **Verify the dashboard config:**
   - `https://STORE.workers.dev/health` returns
     `{"ok":true,"ready":true,"missing":[]}`
   - `https://YOUR_SITE.pages.dev/` loads the storefront

### 4. Configure everything from the admin panel (no redeploys)

Sign in as the owner (Supabase `app_metadata.owner`), open **Admin**:

1. **Settings → Lemon Squeezy payments** — paste your **store ID**.
   Optionally create a "Runway Systems Suite Bundle" product in Lemon
   Squeezy and paste its variant ID into **Bundle variant ID** so
   multi-product receipts read as a bundle.
2. **Products → Lemon Squeezy checkout** — for each product, paste its
   **variant ID** (created under the product in the Lemon Squeezy
   dashboard), its sale price, the delivery link, and the marketing copy.
   Everything edits live from the panel.
3. **Content studio** — suite copy, product stories, legal policies,
   SEO metadata, and the **Site copy** tab (footer, cart, checkout,
   success, sign-in, 404, and navigation-button wording).
4. **Offers** — announcements and discount offers (they inherit to every
   current and future product).
5. **Reviews** — review policy, carousel content.
6. Upload product hero/feature images (stored in R2). Optional: add the
   Workers **AI** binding in the Cloudflare dashboard so feature images get
   auto-written headings.

### 5. First purchase test

1. Buy a product end to end in Lemon Squeezy test mode → hosted checkout
   → back to `/success` → the account library shows the product and the
   delivery email arrives.
2. Refund it in Lemon Squeezy → the entitlement is revoked.
3. Add two products to the cart — one checkout, one payment: the cart
   is bundled into a single custom-priced suite bundle checkout.

### 6. Post-launch

- Submit `sitemap.xml` in Google Search Console (the Worker serves a
  dynamic sitemap that includes products you add later; see DEPLOYMENT.md
  section 4.5 for the one-line redirect that puts it on your storefront
  domain).
- Keep the checklist in **DEPLOYMENT.md section 4** handy for
  verification.

## Troubleshooting quick hits

- **`/health` is not ready** — the response lists the missing pieces;
  for payments that is usually `LEMONSQUEEZY_API_KEY`,
  `LEMONSQUEEZY_WEBHOOK_SECRET`, or the store ID in admin settings.
- **Checkout button says a product is not ready** — the product is
  missing its Lemon Squeezy variant ID.
- **Webhook returns 400** — the `X-Signature` header or the
  `LEMONSQUEEZY_WEBHOOK_SECRET` is wrong; the payload must be the raw body.
- **Buyer paid but the library is empty** — webhook not delivered or not
  subscribed; check Lemon Squeezy's webhook logs.
- **Custom domain** — add it to `connect-src` in `public/_headers` and
  rebuild (see DEPLOYMENT.md).

Read **DEPLOYMENT.md** for the complete, step-by-step version of
everything above.
