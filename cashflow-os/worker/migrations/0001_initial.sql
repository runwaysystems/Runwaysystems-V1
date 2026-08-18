PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  order_identifier TEXT NOT NULL,
  user_id TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  variant_id TEXT NOT NULL DEFAULT '',
  amount_total INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  payment_status TEXT NOT NULL CHECK (payment_status IN ('paid', 'unpaid', 'refunded')),
  product_key TEXT NOT NULL DEFAULT 'cashflow-os',
  delivery_email_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_email_status IN ('pending', 'sending', 'sent', 'failed')),
  delivery_email_attempts INTEGER NOT NULL DEFAULT 0,
  delivery_email_sent_at TEXT,
  delivery_email_last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (order_identifier, product_key)
);

CREATE INDEX IF NOT EXISTS purchases_user_idx ON purchases (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS purchases_order_identifier_idx ON purchases (order_identifier);
CREATE INDEX IF NOT EXISTS purchases_email_queue_idx ON purchases (delivery_email_status, delivery_email_attempts);

CREATE TABLE IF NOT EXISTS revoked_orders (
  order_identifier TEXT PRIMARY KEY,
  refunded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review_requests (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL UNIQUE REFERENCES purchases(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  send_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT,
  feedback_expires_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS review_queue_due_idx ON review_requests (status, send_at);

CREATE TABLE IF NOT EXISTS testimonials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL,
  moderated_at TEXT
);

CREATE INDEX IF NOT EXISTS testimonials_status_idx ON testimonials (status, created_at DESC);
CREATE INDEX IF NOT EXISTS testimonials_user_idx ON testimonials (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'rating' CHECK (kind IN ('rating', 'private')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS feedback_purchase_idx ON feedback (purchase_id, created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS processed_webhooks (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_metrics (
  date TEXT PRIMARY KEY,
  page_views INTEGER NOT NULL DEFAULT 0,
  checkout_starts INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS rate_limits_expiry_idx ON rate_limits (expires_at);
