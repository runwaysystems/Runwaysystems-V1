# Security & secrets policy

This document records the secret-safety rules for this codebase and the
result of the last full audit. Every change must keep this file true.

## Rules

1. **No secret may exist as a string literal in the repository.** API keys,
   passwords, tokens, connection strings, and signing secrets live only in:
   - Cloudflare Worker **secrets** (`wrangler secret put ...`), or
   - environment variables (`import.meta.env.VITE_*` in the frontend,
     `env.*` in the Worker), with placeholder values in example files.
2. **Client exposure:** only public-safe values may use the `VITE_` prefix.
   The Supabase anon key is allowed ONLY because the storefront performs
   authentication and never queries Supabase tables from the browser. If
   client-side data reads are ever added, **Row Level Security must be
   enabled on every Supabase table first**.
3. **Never client-side:** Supabase service_role key, the Lemon Squeezy API
   key and webhook secret, Resend API key, Google Sheets delivery URLs,
   `RATE_LIMIT_SALT`, `FEEDBACK_SIGNING_SECRET`, Workers AI tokens, and any
   database connection string. These exist only as Worker env/secrets.
4. **No payment provider SDK in the frontend.** Checkout is server-created
   and redirects to the Lemon Squeezy hosted page, so no provider
   publishable key is needed anywhere.
5. **Logs and responses:** never log or return secrets. Logs may contain
   only error messages, status codes, and internal IDs. The public
   `/config/public` response must never include `lemonVariantId`,
   `deliveryUrl`, or storage object keys.
6. **Git:** `.env`, `.env.*`, `.dev.vars`, and `.wrangler/` are ignored
   (`.env.example` is the only tracked example). Never commit real values.
7. **Rotation:** if any secret is ever committed, rotate it immediately and
   treat the committed value as permanently compromised — removing it from
   the file is not enough, because it stays in git history.

## Personal data map

Where personal data enters, travels, and ends up.

| Data | Collected at | Sent to | Stored |
|---|---|---|---|
| Name, email, avatar (Google profile) | Google OAuth sign-in (user consents) | Supabase auth token validation (Worker `authenticate`) | Supabase auth records only; session JWT in browser localStorage (Supabase default; no PII in our own localStorage keys) |
| Name, email (checkout) | Lemon Squeezy checkout creation and order webhook | Lemon Squeezy (receipts, account linkage) | D1 `purchases.customer_name` / `customer_email`; Resend delivery emails |
| Card number, CVC, expiry | Never touches our servers; entered on the Lemon Squeezy hosted page only | Lemon Squeezy | Lemon Squeezy only |
| Password | Never collected anywhere (Google handles authentication) | - | - |
| Phone, address, date of birth | Never collected | - | - |
| Testimonial name, rating, text | Feedback page (verified buyer, consented) | None externally | D1 `testimonials` (pending until owner-approved; public name/text only after approval) |
| Feedback rating, text | Feedback page | None externally | D1 `feedback` |
| IP address | Rate limiting only | Never stored; hashed with `RATE_LIMIT_SALT` into a short-lived D1 counter key | Salted hash in `rate_limits`, auto-expiring |
| Page path | Storefront telemetry (`/events/page-view`) | Worker D1 aggregate only | `daily_metrics` (counts, no path list per user) |
| Cart, theme, palette, intro, consent | Browser localStorage | Never leaves the device | localStorage (product keys and UI preferences only, no PII) |
| Uploaded product screenshots (admin) | Admin media uploads | R2 storage; Workers AI only when image scanning is enabled (bytes, no identity) | R2 `product-media/<key>/<uuid>.webp` |

**Deletion:** signed-in users can run `DELETE /account` from the account
library. It detaches purchases (`user_id = 'deleted:' || id`), clears email
and name, deletes review-request rows, withdraws testimonials, clears
feedback text, and removes rate-limit rows. Aggregate metrics are preserved
as anonymous totals. Provider-side records (Lemon Squeezy payments, Resend
sends, Supabase auth) require a support request, as noted in the privacy
policy.

**API response filtering:** every customer-facing endpoint returns only the
fields the client needs. `purchaseFromRow` never includes email, name, or
order identifiers. `/config/public` excludes `lemonVariantId` and
`deliveryUrl`. Delivery URLs are returned only to the verified purchase
owner behind authentication and rate limiting.

## Critical-path audit (auth, payments, input)

Deep audit of the three critical paths, with the fixes applied in the
corresponding commit.

### Authentication & authorization

- Every protected route calls `authenticate` (Supabase token validated
  server-side against the Supabase auth API); all `/admin/*` routes call
  `requireOwner` (role from `app_metadata`, or exact owner-email match).
- **No IDOR:** no endpoint accepts a user id from the client. Purchase
  resources (`/account/purchases/:id/*`) are resolved with
  `user_id = <authenticated user>` and `payment_status = 'paid'`.
- **Password reset: not applicable.** This app has no passwords at all;
  authentication is Google OAuth via Supabase. The analogous flow (signed
  feedback links) uses HMAC-SHA256 with a 30-day expiry, constant-time
  signature comparison, and purchase-owner verification.
- **JWT handling:** the app issues no JWTs. Supabase session tokens are
  validated server-side on every request; expiry and revocation are
  Supabase's domain, and sign-out clears the local session. No blacklist
  is needed for provider tokens we never mint.

### Payment logic

- **Prices are never client-controlled.** Checkout accepts only product
  keys; variants resolve from D1 and quantity is fixed at 1. Multi-product
  carts become one custom-priced suite bundle whose total is computed
  server-side from D1 sale prices - the client can never name an amount.
  The buyer's address and payment details never touch this codebase.
- Webhook signatures are verified (HMAC-SHA256 over the raw body,
  constant-time compare) and events are idempotent via
  `processed_webhooks`.
- Entitlements are created only for orders with `status = 'paid'`;
  refunds revoke all entitlements for the order identifier and cancel
  pending review requests. Refunded orders are remembered in
  `revoked_orders` so a delayed order event cannot re-entitle them. The
  success page polls the account library server-side before showing
  anything.

### Input handling

- **SQL injection:** every query is parameterized (`prepare(...).bind(...)`);
  no string-interpolated SQL exists.
- **XSS:** React escapes all rendered values; no `dangerouslySetInnerHTML`
  or `innerHTML`; email templates escape every user field.
- **Uploads:** owner-only, rate-limited, size-capped (5 MB), stored in R2
  and served with `image/*` content types, `nosniff`, and immutable cache.
  **Fixed:** the declared MIME type of a data URL is attacker-controlled,
  so uploads now also verify magic bytes (PNG signature, JPEG SOI/EOI,
  WebP RIFF/WEBP) before storage.

## Deep audit (Lemon Squeezy single-checkout bundle, 2026-08-15)

Re-audit of auth, payment, and input paths after the Stripe removal and the
suite-bundle checkout. Five issues were found and fixed in the same change:

| Issue | Vulnerability | Location | Fix |
|---|---|---|---|
| Unbounded JSON bodies | A client could POST multi-megabyte JSON to any JSON endpoint (including the public /events/page-view) to burn CPU, memory, and D1 writes | `readJson` in worker/src/index.js | Bodies are capped at 8 MB (covers 7 MB image uploads) with a 413 response before parsing |
| Uncached public reads | /config/public, /sitemap.xml, and /testimonials each ran several D1 queries per request with no server-side cache, so a request flood could exhaust the D1 rows-read quota | worker/src/index.js public routes | caches.default stores each payload (60s config/testimonials, 3600s sitemap); every admin write and account deletion invalidates the cache, so edits stay immediately visible |
| Deeply nested content JSON | A deeply nested content-studio object made JSON.stringify throw RangeError, surfacing as a 500 | `cleanContentJson` | Stringify is guarded; nesting failures return a clean 400 |
| CORS advertised X-Signature | The preflight allow-list advertised a webhook-only header that browsers never legitimately send | `corsHeaders` | X-Signature removed from Access-Control-Allow-Headers |
| Webhook accepted any event type | A signed event with data.type other than orders could reach the entitlement handler | `handleLemonSqueezyWebhook` | Events must have data.type === 'orders', otherwise 400 |

Verified clean in the same audit (no changes needed): SQL injection (34
prepare() queries, zero string interpolation, json_each bound), XSS (no
innerHTML/dangerouslySetInnerHTML, JSON-LD escapes < > &, email templates
escape every field), uploads (magic-byte verification, 5 MB post-decode cap,
constrained storage keys, image/* plus nosniff serving), IDOR (every purchase
resource resolves with user_id plus payment_status), owner enforcement (one
requireOwner gate in front of the whole /admin/* tree), payment integrity
(server-computed bundle total from D1 sale prices, client can only name
product keys, LS webhook HMAC over the raw body with constant-time compare,
status === 'paid' required for entitlements, revoked_orders blocks late
re-entitlement), feedback tokens (HMAC-signed, versioned, purposed,
expiring, constant-time compared, bound to purchase ownership), password
reset N/A (Google OAuth only, no passwords exist), JWTs (none minted; every
request re-validates the Supabase token server-side, so logout revocation is
immediate and no blacklist is needed), and dependency audit (npm audit: 0
vulnerabilities). Regression suite now 80 checks including the new guards.

## Last audit (see git log for the audit commit)

| Check | Result |
|---|---|
| API keys / tokens / passwords / private keys as literals | None found |
| Connection strings (Mongo/Postgres/MySQL/Redis/AMQP) | None — D1 is a binding |
| Lemon Squeezy API key or webhook secret client-side | Never — server-created checkout only, no publishable key used |
| Stripe material anywhere | Removed — the platform is Lemon Squeezy only |
| Supabase service_role key | Never appears |
| Supabase anon key client-side | Yes, by design — auth only, no client DB queries; RLS required before any future client reads |
| OAuth client secret | Never appears (Google OAuth via Supabase) |
| JWT/feedback signing secret | Worker secret `FEEDBACK_SIGNING_SECRET` only |
| Third-party keys (Resend, Workers AI) | Worker env/secrets only |
| `VITE_`/`REACT_APP_`/`NEXT_PUBLIC_` exposure | Only public-safe values; `VITE_OWNER_EMAIL` is optional and documented as bundle-visible |
| JSON body size | Capped at 8 MB in `readJson` with a 413 before parsing |
| Public read caching | config/sitemap/testimonials cached server-side, invalidated on every admin write |
| LS webhook event type | Order events only (`data.type === 'orders'`), plus HMAC signature and idempotency |
| Hardcoded secrets in git history | None — all history contains placeholders only |
| Logs printing secrets | None — all error logs pass through `redactPii` (emails, credential URLs, and long tokens are replaced with `[REDACTED]`); the 5xx handler logs `error.name` and a redacted message instead of the error object |
| Passwords | Never collected, stored, logged, or returned — authentication is fully delegated to Google via Supabase |
| API responses returning secrets | None — public config excludes variant IDs and delivery URLs; purchase responses are field-filtered (no email, name, or order identifiers); delivery URLs return only to verified purchase owners behind auth |
| Account deletion | `DELETE /account` removes/redacts all platform-held personal data; aggregate metrics stay anonymous |
| Environment readiness | `/health` returns 200 with `ready: true` only when every critical variable/binding is set and non-placeholder, otherwise 503 with the missing names; `scripts/deploy.sh --check` refuses placeholder config |
| Security headers | Every Worker response carries nosniff, `X-Frame-Options: DENY`, HSTS (1 year), a `default-src 'none'` CSP, and `Referrer-Policy: no-referrer`; the Pages storefront carries its own CSP in `public/_headers` |
| Correlation ids | Every response has an `X-Correlation-Id` header; error bodies include `correlationId`; detailed errors (redacted) are logged server-side only |
| Rate limiting | Auth-touching endpoints are rate-limited; token validation adds a per-IP auth-gate (300/10 min). Login, OTP, and password reset live at Supabase - enable Supabase rate limits there for those flows |
| CORS | Exact-origin allowlist from `APP_ORIGIN`, no wildcards, explicit methods/headers, `X-Correlation-Id` exposed |
| Database | D1 is a Cloudflare-managed binding: no connection string, no credentials, no public port; TLS is platform-managed. R2 is likewise private and served only through the Worker |
| `.env` / `.dev.vars` ignored | Verified via `git check-ignore` |
| `.env.example` | Placeholders only, with RLS and exposure warnings |
| Test-only values in `tests/` | Local-regression placeholders only, labeled as such |

If a future audit finds a violation, fix it in the same change and add the
rotation note to the changelog entry.
