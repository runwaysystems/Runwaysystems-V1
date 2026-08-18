CREATE TABLE IF NOT EXISTS product_features (
  id TEXT PRIMARY KEY,
  product_key TEXT NOT NULL,
  media_path TEXT NOT NULL DEFAULT '',
  heading TEXT NOT NULL DEFAULT '',
  subheading TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS product_features_product_idx ON product_features (product_key, sort_order ASC);
