CREATE TABLE IF NOT EXISTS products (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'spreadsheet',
  accent TEXT NOT NULL DEFAULT 'lime',
  lemon_variant_id TEXT NOT NULL DEFAULT '',
  delivery_url TEXT NOT NULL DEFAULT '',
  original_price TEXT NOT NULL DEFAULT '',
  sale_price TEXT NOT NULL DEFAULT '',
  offer_label TEXT NOT NULL DEFAULT '',
  offer_active INTEGER NOT NULL DEFAULT 1,
  includes TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS products_active_idx ON products (active, sort_order);
