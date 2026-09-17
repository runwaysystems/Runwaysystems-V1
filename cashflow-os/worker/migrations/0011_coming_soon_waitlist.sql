-- 0011_coming_soon_waitlist.sql
-- Adds product status support ('active', 'coming_soon', 'hidden') and
-- waitlist configuration to products, plus a dedicated product_waitlist
-- table for capturing buyer emails, poll responses, and launch notifications.

ALTER TABLE products ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'coming_soon', 'hidden'));
ALTER TABLE products ADD COLUMN waitlist_config TEXT NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS product_waitlist (
  id TEXT PRIMARY KEY,
  product_key TEXT NOT NULL REFERENCES products(key) ON DELETE CASCADE,
  email TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'product_page',
  poll_response TEXT NOT NULL DEFAULT '',
  welcome_sent_at TEXT,
  notified_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (product_key, email)
);

CREATE INDEX IF NOT EXISTS product_waitlist_product_idx ON product_waitlist (product_key, created_at DESC);
CREATE INDEX IF NOT EXISTS product_waitlist_notify_idx ON product_waitlist (product_key, notified_at);
CREATE INDEX IF NOT EXISTS product_waitlist_email_idx ON product_waitlist (email);
