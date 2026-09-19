-- 0017_blog_newsletter.sql
-- Scanner-safe, double-opt-in subscriptions for Runway Systems Blog email
-- updates. Raw confirmation tokens are sent to the recipient but only their
-- SHA-256 hashes are stored. GET requests never consume confirmation tokens.

CREATE TABLE IF NOT EXISTS newsletter_confirmations (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'site_footer',
  policy_version TEXT NOT NULL DEFAULT 'marketing-v1',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS newsletter_confirmations_email_idx
  ON newsletter_confirmations (email, created_at DESC);

CREATE INDEX IF NOT EXISTS newsletter_confirmations_expiry_idx
  ON newsletter_confirmations (expires_at);
