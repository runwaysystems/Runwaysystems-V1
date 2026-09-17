# Product launch, demo video, and email marketing architecture

**Status:** approved implementation plan  
**Scope:** public coming-soon product pages, waitlists, launch notifications, consent-led email marketing, and administrator-managed product demo videos.

## Goals

1. A product can be public before it can be purchased. Its full product page, SEO, screenshots, FAQs, and demo video remain available, while purchase controls are replaced by a clear **Coming soon** and **Notify me** experience.
2. The owner controls every product's lifecycle, launch behaviour, commercial readiness, and demo video from the existing owner dashboard.
3. A release notification is sent reliably to every active waitlist subscriber when the owner changes the product from `coming_soon` to `live`.
4. The dashboard has a practical email-marketing workspace that can reach eligible contacts with an auditable campaign queue—not a browser loop or a client-side bulk-send.
5. The implementation respects privacy by separating an account/purchase contact record from a marketing subscription. Signing in or buying records a contact for account/delivery purposes; it does **not** silently subscribe someone to promotional marketing.

## Product lifecycle

`active` remains the public visibility switch. A hidden product stays absent from the public config, sitemap, catalog, and direct product route.

`availability` is a separate product state:

| State | Public page | Cart | Checkout | Notify me |
| --- | --- | --- | --- | --- |
| `live` | Yes | Yes | Yes (requires payment variant) | Not shown |
| `coming_soon` | Yes | Optional saved-for-launch cart item | No | Yes |
| `draft` | No (`active = 0`) | No | No | No |

The administrator configures `availability`, optional launch date, and `allowComingSoonCart`. A waitlist product still renders the same complete product template and is indexed as a product page; its schema.org offer becomes `PreOrder` rather than `InStock`.

When availability changes to `live`, the Worker claims that product’s initial launch and durably creates one `launch` campaign with one recipient per active waitlist subscription. The launch campaign is unique per product and recipient rows are unique per campaign/contact, so a retry resumes the same queue rather than creating duplicate emails. If the initial database write fails, the claim is released and the five-minute scheduler recovers the pending launch even if the owner never presses Save again. Re-saving a live product does not duplicate a prior launch send.

## Data model

Migration `0011_launch_marketing_video.sql` adds:

- **`products` fields:** `availability`, `launch_at`, `allow_coming_soon_cart`, `demo_video`, and `launch_notified_at`.
- **`contacts`:** one normalized contact per email. It stores account association when known, contact sources (sign-in/purchase/waitlist), consent status and timestamps. This supports a contact directory without treating every contact as a marketing subscriber.
- **`waitlist_subscriptions`:** a product-specific request for launch notification. A contact can subscribe to many products; each subscription has requested, notification, and unsubscribe state.
- **`marketing_campaigns`:** campaign content, selected audience, lifecycle, recipient counts, and the sending owner.
- **`marketing_recipients`:** immutable, idempotent per-recipient send queue. Its status, attempts, cooldown, provider idempotency key, and errors make campaigns observable and retryable.

Email addresses are normalized (`trim + lowercase`) before persistence. Admin lists expose only the minimum fields required for campaign operations. Free-form provider errors are redacted before storage/logging.

## API design

### Public and authenticated endpoints

- `POST /products/:key/waitlist` — validates a public `coming_soon` product, consent disclosure, and email; upserts the contact and waitlist subscription. It deliberately returns a generic success response so callers cannot enumerate subscribers.
- `POST /contacts/self` — authenticated profile sync from Google/Supabase. It records a sign-in contact but does not grant marketing consent.
- `GET /account/email-preferences` / `PUT /account/email-preferences` — authenticated customer controls for newsletter consent.
- `POST /unsubscribe?token=…` — public one-click unsubscribe action invoked by the storefront unsubscribe page; the link destination itself is the public `/unsubscribe?token=…` route.

### Owner endpoints (fresh JWT + TOTP for writes)

- `GET /admin/marketing/overview` — aggregate counts, recent campaigns, and a compact contact directory.
- `POST /admin/marketing/campaigns` — validates and queues a send-now campaign. Audiences are `subscribers`, `customers`, or `waitlist`, always intersected with explicit marketing consent. The current product can optionally narrow a waitlist audience.

Existing `POST/PATCH /admin/products` and image upload APIs are extended to persist the lifecycle and demo-video configuration. Demo upload is a dedicated endpoint accepting a bounded, MP4/WebM data payload and storing it in R2 as `product-media/<product>/<uuid>.(mp4|webm)`. The public media endpoint validates the path and serves range requests with immutable caching so browsers can seek without downloading the whole file first.

## Email delivery

The Worker sends via Brevo from `EMAIL_FROM_INFO` (configured as `info@runwaysystems.cloud`). It uses the existing quota/cooldown system and provider idempotency headers.

- **Waitlist confirmation / launch notice:** requested product notification. The launch recipient is queued exactly once per subscription.
- **Marketing campaign:** only contacts with affirmative `marketing_consent = 1` and no unsubscribe date. Every message includes an unsubscribe link and physical/contact footer placeholder managed in settings.
- **Purchase delivery and review mail:** remain transactional and are not mixed with campaign audiences.

The five-minute cron first processes current transactional email, then bounded marketing/launch recipients. A failed recipient is retried up to five times with provider cooldown. Campaign completion is derived from recipient rows, never assumed from an HTTP response. Before delivery work, the same cron also recovers an initial product launch whose campaign queue could not be saved during the dashboard request.

## User interface

### Storefront

- Product cards display a **Coming soon** chip and a `Notify me` shortcut for waitlist products.
- Product hero, pricing card, final CTA, and navbar replace buy controls with an accessible email form. The form explicitly links to Terms and Privacy and includes a clear statement that the address is used for this product's launch notice; optional marketing consent is separate.
- A product with `allowComingSoonCart` can be saved to the cart. The cart labels it **Saved for launch**, excludes it from today’s payable total, and explains that it will become purchasable when live. It is not sent to Lemon Squeezy until its availability is `live`.
- A product demo section appears only when an owner-uploaded video exists. It uses native video controls, a poster derived from the hero visual when available, metadata controls, responsive sizing, and a no-autoplay policy.

### Owner dashboard

- The product editor gets a **Release & availability** group with state, launch date, and save-to-cart toggle.
- The product media area gets a **Product demo video** uploader/replacer/remover and a concise R2 delivery note.
- The new **Email marketing** section shows contact counts, recent campaign health, a consent-aware audience selector, campaign composer, send confirmation, and a recent campaign list.

## Privacy, terms, and cookie position

- The existing Cookie preferences mechanism remains for essential browser storage; campaign and waitlist consent are not implemented as cookie consent.
- Privacy policy text explains contact sources, waitlist notices, marketing consent, Brevo processing, unsubscribe rights, queue retention, and deletion behaviour.
- Terms clarify that coming-soon pages are informational, availability is not a purchase offer, and a waitlist request does not reserve a price or create a contract.
- Account deletion removes/de-identifies the contact, closes its waitlist subscriptions, cancels pending campaign recipients, and prevents future sends while retaining only records that law requires.

This is a product architecture and engineering baseline, not legal advice. Before production launch, the operator must have legal counsel adapt retention periods, company identity, and lawful bases to its jurisdictions.

## Operational rollout

1. Apply the D1 migration and deploy the Worker with the R2 bucket binding already present.
2. Verify `EMAIL_FROM_INFO=info@runwaysystems.cloud` in Brevo and configure a valid marketing footer/company address.
3. Publish a test product as `coming_soon`, add a waitlist address, then change it to `live` and inspect the queued/sent campaign recipient.
4. Verify video upload, signed owner access, range requests, responsive playback, and media replacement cleanup.
5. Send a test campaign to the owner’s consented address; verify unsubscribe and account preference changes before any bulk campaign.
