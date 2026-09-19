-- 0013_security_marketing_checkout.sql
-- Security and reliability hardening for explicit marketing consent,
-- scanner-safe unsubscribe links, asynchronous campaign delivery, exact
-- checkout correlation, and integer product prices.

-- Marketing contact consent is independent from account, purchase, and
-- waitlist transactional email. Existing contacts are made ineligible for
-- campaigns until an explicit opt-in is recorded.
ALTER TABLE audience_contacts ADD COLUMN marketing_opt_in_at TEXT NOT NULL DEFAULT '';
ALTER TABLE audience_contacts ADD COLUMN marketing_opt_in_source TEXT NOT NULL DEFAULT '';
ALTER TABLE audience_contacts ADD COLUMN marketing_opt_in_policy_version TEXT NOT NULL DEFAULT '';
UPDATE audience_contacts SET status = 'unsubscribed' WHERE marketing_opt_in_at = '';

CREATE TABLE IF NOT EXISTS marketing_suppressions (
  email_hash TEXT PRIMARY KEY,
  unsubscribed_at TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'recipient_request'
);

-- Raw tokens are sent to recipients but never stored. A random token's hash
-- maps to the recipient and can be used only for unsubscription.
CREATE TABLE IF NOT EXISTS marketing_unsubscribe_tokens (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX IF NOT EXISTS marketing_unsubscribe_tokens_expiry_idx
  ON marketing_unsubscribe_tokens (expires_at);

CREATE TABLE IF NOT EXISTS waitlist_action_tokens (
  token_hash TEXT PRIMARY KEY,
  waitlist_id TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS waitlist_action_tokens_expiry_idx
  ON waitlist_action_tokens (expires_at);

-- Campaign requests enqueue durable recipient jobs. The cron worker claims
-- and sends bounded batches, so an interrupted request cannot lose its place
-- or cause already-sent recipients to be sent twice.
CREATE TABLE IF NOT EXISTS marketing_deliveries (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL CHECK (kind IN ('campaign', 'waitlist_launch')),
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  unsubscribe_url TEXT NOT NULL DEFAULT '',
  waitlist_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_eligible_at TEXT NOT NULL DEFAULT '',
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sent_at TEXT,
  dedupe_key TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS marketing_deliveries_queue_idx
  ON marketing_deliveries (status, next_eligible_at, created_at);
CREATE INDEX IF NOT EXISTS marketing_deliveries_campaign_idx
  ON marketing_deliveries (campaign_id, status);

ALTER TABLE marketing_campaigns ADD COLUMN status TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE marketing_campaigns ADD COLUMN sent_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE marketing_campaigns ADD COLUMN failed_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE marketing_campaigns ADD COLUMN completed_at TEXT NOT NULL DEFAULT '';

-- Keep an exact provider checkout reference on every entitlement.
ALTER TABLE purchases ADD COLUMN checkout_id TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS purchases_checkout_idx ON purchases (checkout_id, user_id);

-- Monetary values used to create custom-priced multi-product checkouts are
-- represented as integer minor units, never parsed from presentation text.
ALTER TABLE products ADD COLUMN price_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD';
UPDATE products
SET price_cents = CAST(ROUND(CAST(REPLACE(REPLACE(REPLACE(sale_price, '$', ''), ',', ''), ' ', '') AS REAL) * 100) AS INTEGER)
WHERE price_cents = 0 AND sale_price GLOB '*[0-9]*';
