-- 0015_complimentary_access.sql
-- Owner-issued, zero-cost product access with scanner-safe one-time claims.
-- Paid orders remain financially authoritative and are distinguished by the
-- access_source column in every aggregate query.

ALTER TABLE purchases ADD COLUMN access_source TEXT NOT NULL DEFAULT 'paid';
ALTER TABLE purchases ADD COLUMN access_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE purchases ADD COLUMN complimentary_grant_id TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS purchases_access_idx
  ON purchases (access_source, access_status, payment_status, created_at);
CREATE INDEX IF NOT EXISTS purchases_complimentary_grant_idx
  ON purchases (complimentary_grant_id, product_key);

ALTER TABLE audience_contacts ADD COLUMN complimentary_status TEXT NOT NULL DEFAULT '';
ALTER TABLE audience_contacts ADD COLUMN complimentary_products TEXT NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS complimentary_grants (
  id TEXT PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  recipient_email_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'claimed', 'cancelled', 'expired', 'revoked')),
  token_hash TEXT UNIQUE,
  token_ciphertext TEXT,
  token_expires_at TEXT NOT NULL,
  token_used_at TEXT,
  claimed_by_user_id TEXT NOT NULL DEFAULT '',
  claimed_at TEXT,
  accepted_policy_version TEXT NOT NULL DEFAULT '',
  accepted_policy_text TEXT NOT NULL DEFAULT '',
  created_by_user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  email_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (email_status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  email_attempts INTEGER NOT NULL DEFAULT 0,
  email_sent_at TEXT,
  email_next_eligible_at TEXT NOT NULL DEFAULT '',
  email_last_error TEXT,
  review_invited_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS complimentary_grants_recipient_idx
  ON complimentary_grants (recipient_email, status, created_at DESC);
CREATE INDEX IF NOT EXISTS complimentary_grants_queue_idx
  ON complimentary_grants (email_status, email_next_eligible_at, created_at);
CREATE INDEX IF NOT EXISTS complimentary_grants_status_idx
  ON complimentary_grants (status, created_at DESC);
CREATE INDEX IF NOT EXISTS complimentary_grants_expiry_idx
  ON complimentary_grants (status, token_expires_at);

CREATE TABLE IF NOT EXISTS complimentary_grant_items (
  grant_id TEXT NOT NULL REFERENCES complimentary_grants(id) ON DELETE CASCADE,
  product_key TEXT NOT NULL,
  purchase_id TEXT NOT NULL DEFAULT '',
  item_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (item_status IN ('pending', 'granted', 'already_owned', 'revoked')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (grant_id, product_key)
);
CREATE INDEX IF NOT EXISTS complimentary_grant_items_purchase_idx
  ON complimentary_grant_items (purchase_id);
