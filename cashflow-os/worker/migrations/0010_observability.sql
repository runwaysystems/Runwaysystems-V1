-- 0010_observability.sql
-- Client-side error telemetry reported by the storefront (render crashes,
-- unhandled script errors, rejected promises). Rows are ingested through
-- POST /events/client-error with per-IP rate limiting, payload caps and
-- PII redaction, and are pruned by the cron tick after 30 days so the
-- table cannot grow without bound. Personal data policy: message, stack
-- and url pass through redactPii() before insert; the source IP is only
-- stored as a salted SHA-256 hash, matching the rate_limits approach.
CREATE TABLE IF NOT EXISTS client_errors (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'error',
  message TEXT NOT NULL DEFAULT '',
  stack TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  ip_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS client_errors_created_idx ON client_errors (created_at DESC);
CREATE INDEX IF NOT EXISTS client_errors_kind_idx ON client_errors (kind, created_at DESC);
