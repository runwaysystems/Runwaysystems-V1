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
3. **Never public/client-configured:** Supabase service_role key, the Lemon
   Squeezy API key and webhook secret, Brevo API key, `RATE_LIMIT_SALT`,
   `FEEDBACK_SIGNING_SECRET`, `TOTP_ENCRYPTION_KEY`, Workers AI tokens, and
   any database credential. Private Google Sheets delivery URLs live in D1
   and are returned only to authenticated owners of paid purchases.
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
| Name, email, avatar (Google profile) | Google OAuth sign-in (user consents) | Supabase auth token validation; limited profile fields sync to the Worker | Supabase auth/session storage and D1 `audience_contacts` (unsubscribed unless explicit marketing consent) |
| Name, email (checkout) | Lemon Squeezy checkout creation and order webhook | Lemon Squeezy (receipts, account linkage) | D1 `purchases.customer_name` / `customer_email`; Brevo delivery emails |
| Invited email and selected products (complimentary access) | Owner-only, TOTP-elevated grant form | Brevo transactional invitation; Supabase exact-email verification at claim | D1 `complimentary_grants` and items; token stored as a hash plus AES-GCM ciphertext until claim/expiry; zero-cost entitlement after claim |
| Blog email address and consent | Route-aware signup above the original-design site footer, with explicit checkbox and double opt-in | Brevo confirmation and later owner-controlled consented campaigns | D1 `newsletter_confirmations` stores email, token hash, source, policy version, and 48-hour expiry; confirmed consent enters `audience_contacts` |
| Card number, CVC, expiry | Never touches our servers; entered on the Lemon Squeezy hosted page only | Lemon Squeezy | Lemon Squeezy only |
| Password | Never collected anywhere (Google handles authentication) | - | - |
| Phone, address, date of birth | Never collected | - | - |
| Testimonial name, rating, text | Feedback page (verified buyer, consented) | None externally | D1 `testimonials` (pending until owner-approved; public name/text only after approval) |
| Feedback rating, text | Feedback page | None externally | D1 `feedback` |
| IP address | Rate limiting and admin audit provenance | Never stored raw; domain-separated hashes use `RATE_LIMIT_SALT` | Short-lived `rate_limits` hashes; admin audit hashes retained at most 365 days |
| Page path | Storefront telemetry (`/events/page-view`) | Worker D1 aggregate only | `daily_metrics` (counts, no path list per user) |
| Cart, theme, palette, intro, consent | Browser localStorage | Never leaves the device | localStorage (product keys and UI preferences only, no PII) |
| Uploaded product screenshots (admin) | Admin media uploads | R2 storage; Workers AI only when image scanning is enabled (bytes, no identity) | R2 `product-media/<key>/<uuid>.webp` |

**Deletion:** signed-in users can run `DELETE /account` from the account
library. It detaches purchases (`user_id = 'deleted:' || id`), clears email
and name, deletes review-request rows, withdraws testimonials, clears
feedback text, deletes waitlist and reusable action-token rows, invalidates
pending complimentary claims, anonymizes claimed grant provenance, and creates
a durable marketing suppression. Short-lived salted rate-limit hashes cannot be
linked back for per-user deletion and expire automatically. Aggregate metrics are preserved
as anonymous totals. The Worker also requests deletion of the Supabase authentication identity.
External merchant-of-record payment/tax records and Brevo provider logs follow
those providers' legal retention and data-request processes.

**API response filtering:** every customer-facing endpoint returns only the
fields the client needs. `purchaseFromRow` never includes email, name, or
order identifiers. `/config/public` excludes `lemonVariantId` and
`deliveryUrl`. Delivery URLs are returned only to the verified purchase
owner behind authentication and rate limiting.

## Critical-path audit (auth, payments, input)

Deep audit of the three critical paths, with the fixes applied in this
repository.

### Authentication & authorization

- Every protected route calls `authenticate` (Supabase token validated
  server-side against the Supabase auth API); all `/admin/*` routes call
  `requireOwner` (role from `app_metadata`, or exact owner-email match).
- Admin mutations require a recent owner session and verified TOTP enrollment.
  One authenticator or single-use recovery code produces a signed,
  session-bound five-minute challenge; the browser stores only that challenge,
  never a raw rotating or recovery code. TOTP seeds are AES-GCM encrypted at
  rest with a purpose-derived key, and recovery codes are stored only as
  hashes. Pending enrollment cannot authorize unrelated mutations.
- **No IDOR:** no endpoint accepts a user id from the client. Purchase
  resources (`/account/purchases/:id/*`) are resolved with
  `user_id = <authenticated user>`, active access, and a valid entitlement.
- **Complimentary claims:** owner issuance requires the normal TOTP-elevated
  mutation gate. Email links contain a random token in the URL fragment, GET
  never claims, and authenticated POST requires the exact verified invited
  email. Tokens are hashed for lookup, encrypted only while needed for email
  retry, rotated on resend, and erased on claim/cancel/expiry/revocation.
- **Password reset: not applicable.** This app has no passwords at all;
  authentication is Google OAuth via Supabase. The analogous flow (signed
  feedback links) uses HMAC-SHA256 with a 30-day expiry, constant-time
  signature comparison, and purchase-owner verification.
- **Session handling:** Supabase session tokens are validated server-side on
  every request; expiry and revocation are Supabase's domain, and sign-out
  clears the local session. The Worker additionally mints only short-lived
  HMAC-signed admin elevation challenges bound to the owner and session issue
  time; these carry no provider authority.

### Payment logic

- **Prices are never client-controlled.** Checkout accepts only product
  keys; variants resolve from D1 and quantity is fixed at 1. Multi-product
  carts become one custom-priced suite bundle whose total is computed
  server-side from integer D1 `price_cents` fields - the client can never name an amount.
  The buyer's address and payment details never touch this codebase.
- Webhook signatures are verified (HMAC-SHA256 over the raw body,
  constant-time compare) and events are idempotent via
  `processed_webhooks`.
- Entitlements are created only for orders with `status = 'paid'`;
  refunds revoke all entitlements for the order identifier and cancel
  pending review requests. Refunded orders are remembered in
  `revoked_orders` so a delayed order event cannot re-entitle them. The
  success page polls only the exact checkout ID bound to the signed-in user before showing anything.

### Input handling

- **SQL injection:** every query is parameterized (`prepare(...).bind(...)`);
  no string-interpolated SQL exists.
- **XSS:** React escapes rendered values. The one campaign-preview
  `dangerouslySetInnerHTML` site receives only locally formatted text that is
  HTML-escaped before limited bold/emphasis markup is introduced; email
  templates likewise escape every user field.
- **Uploads:** owner-only, rate-limited, size-capped (5 MB), stored in R2
  and served with `image/*` content types, `nosniff`, and immutable cache.
  **Fixed:** the declared MIME type of a data URL is attacker-controlled,
  so uploads now also verify magic bytes (PNG signature, JPEG SOI/EOI,
  WebP RIFF/WEBP) before storage.

### Blog publishing boundary

- Public Blog queries enforce one shared predicate: published status, a non-future publication time, and no deletion marker. Drafts, scheduled records, archives, trash, revisions, and owner metadata never enter the public projection.
- Imports accept bounded Markdown, text, or HTML and always create drafts. Active HTML elements are removed, React Markdown skips raw HTML, links reject unsafe schemes, and remote Markdown images are rejected in favor of byte-verified R2 media. Imported scripts, styles, forms, embeds, and trackers do not execute.
- Blog mutations live under the existing owner authentication, recent-session, CSRF/origin, rate-limit, and five-minute TOTP challenge boundary. Optimistic versions return 409 rather than overwriting a newer tab.
- PNG, JPEG, and WebP media is magic-byte and dimension checked, content-hash deduplicated, served with `nosniff` and immutable caching, and protected from deletion while usage rows exist. Alt text is required for published cover and inline media.
- Pages first-response rendering consumes only the public Worker projection and escapes Markdown into semantic HTML. API failure yields 503; unknown/private slugs yield a noindex 404; old canonical slugs yield a cacheable 308.
- Lifecycle and content changes write body-free audit events and durable publication outbox records. Sitemap, RSS, LLM files, and scheduled publication are generated from server state and remain idempotent.

### Blog newsletter boundary

- Signup requires explicit consent, a blank honeypot, bounded JSON, valid email,
  exact-origin CORS, and independent per-IP and per-email limits. It returns a
  generic response that does not expose existing audience state.
- Confirmation tokens contain 256 bits of randomness, are stored only as
  SHA-256 hashes, expire after 48 hours, and are carried in URL fragments so
  mail scanners cannot send them to the server. GET never mutates consent;
  one-time POST confirmation is required and replay returns 410.
- Sign-in, payment, waitlist membership, feedback, and complimentary access do
  not imply Blog consent. A prior suppression is cleared only after a fresh
  confirmed opt-in. Existing token-only unsubscribe and durable suppression
  controls apply to every later campaign.
- Confirmation pages are noindex, omitted from the sitemap, and disallowed in
  robots. Pending and used confirmation records are pruned by scheduled
  retention, and account deletion removes records for the account email.

## Deep audit (Lemon Squeezy single-checkout bundle, 2026-08-15)

Re-audit of auth, payment, and input paths after the Stripe removal and the
suite-bundle checkout. Five issues were found and fixed in the same change:

| Issue | Vulnerability | Location | Fix |
|---|---|---|---|
| Unbounded JSON bodies | A client could POST multi-megabyte JSON to any JSON endpoint (including the public /events/page-view) to burn CPU, memory, and D1 writes | `readJson` in worker/src/index.js | Bodies are capped at 8 MB (covers 7 MB image uploads) with a 413 response before parsing |
| Uncached public reads | /config/public, /sitemap.xml, and /testimonials each ran several D1 queries per request with no server-side cache, so a request flood could exhaust the D1 rows-read quota | worker/src/index.js public routes | caches.default stores each payload briefly (60s config/sitemap/testimonials); every admin write and account deletion invalidates the cache, so edits stay immediately visible |
| Deeply nested content JSON | A deeply nested content-studio object made JSON.stringify throw RangeError, surfacing as a 500 | `cleanContentJson` | Stringify is guarded; nesting failures return a clean 400 |
| CORS advertised X-Signature | The preflight allow-list advertised a webhook-only header that browsers never legitimately send | `corsHeaders` | X-Signature removed from Access-Control-Allow-Headers |
| Webhook accepted any event type | A signed event with data.type other than orders could reach the entitlement handler | `handleLemonSqueezyWebhook` | Events must have data.type === 'orders', otherwise 400 |

Verified controls include bound prepared D1 queries; escaped browser, JSON-LD,
and email output; magic-byte-verified uploads; per-user entitlement lookup;
one owner gate over the complete `/admin/*` tree; server-authoritative prices;
raw-body webhook HMAC and durable refund revocation; purpose-bound expiring
feedback and complimentary tokens; server-side Supabase token validation; and
an npm audit with zero known vulnerabilities. The local Worker regression now
covers 186 checks, including Blog newsletter double opt-in, publication/discovery isolation, scheduled idempotency, exact-email complimentary grants, and paid-metric isolation.

## Last audit (see git log for the audit commit)

| Check | Result |
|---|---|
| API keys / tokens / passwords / private keys as literals | None found |
| Connection strings (Mongo/Postgres/MySQL/Redis/AMQP) | None — D1 is a binding |
| Lemon Squeezy API key or webhook secret client-side | Never — server-created checkout only, no publishable key used |
| Stripe material anywhere | Removed — the platform is Lemon Squeezy only |
| Supabase service_role key | Required only as a Worker secret for fail-closed webhook ownership checks; never shipped client-side |
| Supabase anon key client-side | Yes, by design — auth only, no client DB queries; RLS required before any future client reads |
| OAuth client secret | Never appears (Google OAuth via Supabase) |
| JWT/feedback signing secret | Worker secret `FEEDBACK_SIGNING_SECRET` only |
| TOTP and pending complimentary token encryption | Purpose-separated AES-GCM keys derived from Worker-only `TOTP_ENCRYPTION_KEY`; plaintext TOTP seeds never enter D1, and raw claim tokens are erased after lifecycle completion |
| Third-party keys (Brevo, Workers AI) | Worker env/secrets only |
| `VITE_`/`REACT_APP_`/`NEXT_PUBLIC_` exposure | Only public-safe values; `VITE_OWNER_EMAIL` is optional and documented as bundle-visible |
| JSON/webhook body size | Streamed through an 8 MB byte cap with 413 before parsing or signature work; does not buffer an unbounded chunked body |
| Public read caching | config/sitemap/testimonials cached server-side, invalidated on every admin write |
| LS webhook event type | Order objects only, plus raw-body HMAC, idempotency, Supabase ownership re-check, exact authenticated checkout/product correlation, and authoritative subtotal/currency validation before entitlements |
| Complimentary access | TOTP-elevated issuance; exact verified-email claim; no GET mutation; one-time encrypted/hashed tokens; zero impact on paid sales and revenue |
| Blog email signup | Explicit consent plus honeypot and dual rate limits; generic response; 48-hour hash-only fragment token; POST-only one-time confirmation; durable unsubscribe suppression |
| Hardcoded secrets in the current tracked tree | Secret values are not tracked; examples contain labeled placeholders only. History must still be scanned before each public release. |
| Logs printing secrets | None — all error logs pass through `redactPii` (emails, credential URLs, and long tokens are replaced with `[REDACTED]`); the 5xx handler logs `error.name` and a redacted message instead of the error object |
| Passwords | Never collected, stored, logged, or returned — authentication is fully delegated to Google via Supabase |
| API responses returning secrets | None — public config excludes variant IDs and delivery URLs; purchase responses are field-filtered (no email, name, or order identifiers); delivery URLs return only to verified purchase owners behind auth |
| Account deletion | `DELETE /account` removes/redacts all platform-held personal data; aggregate metrics stay anonymous |
| Environment readiness | `/health` returns 200 with `ready: true` only when every critical variable/binding is set and non-placeholder, otherwise 503 with the missing names; `scripts/deploy.sh --check` refuses placeholder config |
| Security headers | Every Worker response carries nosniff, `X-Frame-Options: DENY`, HSTS (1 year), a `default-src 'none'` CSP, and `Referrer-Policy: no-referrer`; the Pages storefront carries its own CSP in `public/_headers` |
| Cloudflare HTML mutation | Pages sends `Cache-Control: no-transform`, so automatic Cloudflare Web Analytics and JavaScript Detection do not inject an external beacon or a request-specific inline script into a static, strict-CSP document. Do not add `unsafe-inline` or a copied console hash; opt in only with nonce-generating edge middleware. |
| OAuth avatars | `img-src` allows Google user-content hosts and COEP uses `credentialless`, so public Google profile images can render without third-party credentials; the UI falls back to initials on any image error. |
| Correlation ids | Every response has an `X-Correlation-Id` header; error bodies include `correlationId`; detailed errors (redacted) are logged server-side only |
| Rate limiting | Auth-touching endpoints are rate-limited; token validation adds a per-IP auth-gate (300/10 min). Login, OTP, and password reset live at Supabase - enable Supabase rate limits there for those flows |
| CORS | Exact-origin allowlist from `APP_ORIGIN`, no wildcards, explicit methods/headers, `X-Correlation-Id` exposed |
| Database | D1 is a Cloudflare-managed binding: no connection string, no credentials, no public port; TLS is platform-managed. R2 is likewise private and served only through the Worker |
| `.env` / `.dev.vars` ignored | Verified via `git check-ignore` |
| `.env.example` | Placeholders only, with RLS and exposure warnings |
| Test-only values in `tests/` | Local-regression placeholders only, labeled as such |

If a future audit finds a violation, fix it in the same change and add the
rotation note to the changelog entry.
