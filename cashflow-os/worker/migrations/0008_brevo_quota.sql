-- Single-row table that records the last known state of the Brevo SMTP
-- quota. Written by sendBrevo() whenever Brevo returns 429/400 with a
-- quota message, and read by the cron email worker so a known-exhausted
-- state can short-circuit a whole tick without burning 5 retries per row.
--
-- The PRIMARY KEY is a constant so we always have exactly one current row.
-- We UPDATE on conflict, so the table is one row, not a log.
CREATE TABLE IF NOT EXISTS brevo_quota (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  exhausted_at TEXT NOT NULL,
  retry_after_seconds INTEGER NOT NULL DEFAULT 0,
  message TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

-- Per-row cooldown for the email queues. Distinct from `updated_at`
-- because updated_at has many other writers; this column is the single
-- source of truth for "when is this row next eligible for a retry attempt?"
-- The cron tick's WHERE clause is `next_eligible_at <= now`, which lets
-- a Retry-After hint from Brevo (e.g. "wait 1 hour") be honored precisely
-- without leaking through other columns.
ALTER TABLE purchases ADD COLUMN delivery_email_next_eligible_at TEXT NOT NULL DEFAULT '';
ALTER TABLE review_requests ADD COLUMN next_eligible_at TEXT NOT NULL DEFAULT '';
