-- Named product bundles priced as a percentage off the sum of their members.
--
-- Percentage rather than a fixed price on purpose: product prices are stored
-- as display text ("$39") and are edited freely from the owner dashboard, so
-- a stored fixed bundle price would silently drift out of step the moment a
-- member product changed. A percentage stays correct by construction.
CREATE TABLE IF NOT EXISTS bundles (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  -- JSON array of product keys. Membership is validated against the products
  -- table on write, and re-checked at checkout so a deleted product can never
  -- be sold inside a stale bundle.
  product_keys TEXT NOT NULL DEFAULT '[]',
  -- Whole percent, 1-90. The checkout total is the sum of member sale prices
  -- reduced by this much, rounded to the nearest cent.
  discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 90),
  lemon_variant_id TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS bundles_active_idx ON bundles (active, sort_order);
