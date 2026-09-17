-- Public launch lifecycle, product demo media, consent-led contacts, and the
-- durable email campaign queue. `active` still owns public visibility;
-- `availability` owns whether a visible product is purchasable.
ALTER TABLE products ADD COLUMN availability TEXT NOT NULL DEFAULT 'live' CHECK (availability IN ('live', 'coming_soon'));
ALTER TABLE products ADD COLUMN launch_at TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN allow_coming_soon_cart INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN demo_video TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN launch_notified_at TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  first_source TEXT NOT NULL DEFAULT 'unknown',
  last_source TEXT NOT NULL DEFAULT 'unknown',
  marketing_consent INTEGER NOT NULL DEFAULT 0 CHECK (marketing_consent IN (0, 1)),
  marketing_consented_at TEXT NOT NULL DEFAULT '',
  unsubscribed_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS contacts_user_idx ON contacts (user_id);
CREATE INDEX IF NOT EXISTS contacts_marketing_idx ON contacts (marketing_consent, unsubscribed_at, updated_at DESC);

CREATE TABLE IF NOT EXISTS waitlist_subscriptions (
  id TEXT PRIMARY KEY,
  product_key TEXT NOT NULL REFERENCES products(key) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed', 'notified', 'unsubscribed')),
  requested_at TEXT NOT NULL,
  notified_at TEXT NOT NULL DEFAULT '',
  unsubscribed_at TEXT NOT NULL DEFAULT '',
  consent_version TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(product_key, contact_id)
);
CREATE INDEX IF NOT EXISTS waitlist_product_status_idx ON waitlist_subscriptions (product_key, status, requested_at);

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'marketing' CHECK (kind IN ('marketing', 'launch')),
  product_key TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT 'subscribers',
  subject TEXT NOT NULL,
  preheader TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  cta_label TEXT NOT NULL DEFAULT '',
  cta_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'completed', 'failed')),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT '',
  completed_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS marketing_campaigns_created_idx ON marketing_campaigns (created_at DESC);
-- A product's first public launch has exactly one durable campaign. Retries use
-- this same campaign and its per-contact unique recipient rows rather than
-- sending a subscriber the announcement twice.
CREATE UNIQUE INDEX IF NOT EXISTS marketing_launch_product_once_idx
  ON marketing_campaigns(product_key) WHERE kind = 'launch';

CREATE TABLE IF NOT EXISTS marketing_recipients (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_eligible_at TEXT NOT NULL DEFAULT '',
  sent_at TEXT NOT NULL DEFAULT '',
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(campaign_id, contact_id)
);
CREATE INDEX IF NOT EXISTS marketing_recipients_queue_idx ON marketing_recipients (status, next_eligible_at, created_at);
