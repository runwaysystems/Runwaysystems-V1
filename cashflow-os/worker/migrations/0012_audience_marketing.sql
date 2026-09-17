-- 0012_audience_marketing.sql
-- Unified audience contacts tracking every Google OAuth sign-in lead, verified buyer, and waitlist subscriber,
-- plus marketing campaign broadcast history sent via Brevo.

CREATE TABLE IF NOT EXISTS audience_contacts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'google_signin' CHECK (source IN ('google_signin', 'checkout', 'waitlist', 'manual')),
  status TEXT NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed', 'unsubscribed')),
  is_customer INTEGER NOT NULL DEFAULT 0,
  total_spend_cents INTEGER NOT NULL DEFAULT 0,
  orders_count INTEGER NOT NULL DEFAULT 0,
  products_owned TEXT NOT NULL DEFAULT '[]',
  waitlists_joined TEXT NOT NULL DEFAULT '[]',
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS audience_contacts_email_idx ON audience_contacts (email);
CREATE INDEX IF NOT EXISTS audience_contacts_customer_idx ON audience_contacts (is_customer);
CREATE INDEX IF NOT EXISTS audience_contacts_status_idx ON audience_contacts (status);
CREATE INDEX IF NOT EXISTS audience_contacts_created_idx ON audience_contacts (created_at DESC);

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL,
  preview_text TEXT NOT NULL DEFAULT '',
  target_segment TEXT NOT NULL DEFAULT 'all',
  target_product_key TEXT NOT NULL DEFAULT '',
  cta_label TEXT NOT NULL DEFAULT '',
  cta_url TEXT NOT NULL DEFAULT '',
  discount_code TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_by TEXT NOT NULL DEFAULT '',
  sent_at TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS marketing_campaigns_sent_idx ON marketing_campaigns (sent_at DESC);
