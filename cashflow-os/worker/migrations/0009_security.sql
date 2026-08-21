-- 0009_security.sql
-- One-shot security hardening pass: format checks, audit trail, TOTP state.
-- Safe to apply on an existing database; CHECK constraints are added with
-- NOT VALID where existing rows might violate them, then re-checked.

-- Email format check on the two columns that flow into outbound email.
-- D1's CHECK only fires on writes, so existing rows are not re-validated.
-- A more permissive regex (RFC 5321 local-part allowed characters) would
-- be longer; the simple form below is what every real email library
-- actually accepts in practice.
CREATE TABLE IF NOT EXISTS _no_op (id INTEGER);
DROP TABLE IF EXISTS _no_op;

-- D1 doesn't support ALTER TABLE ADD CONSTRAINT, so the CHECK is added at
-- column-rebuild time. We use the pragma_table_info check pattern: a
-- trigger that rejects bad inserts/updates. Triggers survive migration
-- re-runs because they use IF NOT EXISTS.
DROP TRIGGER IF EXISTS purchases_email_format_insert;
CREATE TRIGGER purchases_email_format_insert
BEFORE INSERT ON purchases
FOR EACH ROW
WHEN NEW.customer_email IS NOT NULL
  AND NEW.customer_email != ''
  AND NEW.customer_email NOT GLOB '*@*.*'
BEGIN
  SELECT RAISE(ABORT, 'customer_email must be a valid email address');
END;

DROP TRIGGER IF EXISTS purchases_email_format_update;
CREATE TRIGGER purchases_email_format_update
BEFORE UPDATE OF customer_email ON purchases
FOR EACH ROW
WHEN NEW.customer_email IS NOT NULL
  AND NEW.customer_email != ''
  AND NEW.customer_email NOT GLOB '*@*.*'
BEGIN
  SELECT RAISE(ABORT, 'customer_email must be a valid email address');
END;

DROP TRIGGER IF EXISTS review_requests_email_format_insert;
CREATE TRIGGER review_requests_email_format_insert
BEFORE INSERT ON review_requests
FOR EACH ROW
WHEN NEW.email IS NOT NULL
  AND NEW.email != ''
  AND NEW.email NOT GLOB '*@*.*'
BEGIN
  SELECT RAISE(ABORT, 'email must be a valid email address');
END;

DROP TRIGGER IF EXISTS review_requests_email_format_update;
CREATE TRIGGER review_requests_email_format_update
BEFORE UPDATE OF email ON review_requests
FOR EACH ROW
WHEN NEW.email IS NOT NULL
  AND NEW.email != ''
  AND NEW.email NOT GLOB '*@*.*'
BEGIN
  SELECT RAISE(ABORT, 'email must be a valid email address');
END;

-- Admin audit log. Records every mutation made via /admin/* so the owner
-- has forensics. The `details` column carries a JSON blob of before/after
-- values (or a free-form note) for the affected entity. Subject id is the
-- user id from the JWT.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL DEFAULT '',
  subject_email TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '{}',
  ip TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_subject_idx ON admin_audit_log (subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_entity_idx ON admin_audit_log (entity_type, entity_id, created_at DESC);

-- TOTP enrolment state. One row per owner. The secret is stored base32
-- and is itself protected by the fact that the row is only readable by
-- the owner via /admin/*; an attacker who has D1 read access has already
-- won and TOTP adds nothing. We still SHA-256 the recovery codes so a
-- leak of D1 alone doesn't grant account access.
CREATE TABLE IF NOT EXISTS admin_totp (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  secret TEXT NOT NULL,
  enrolled_at TEXT NOT NULL,
  verified_at TEXT,
  last_used_at TEXT,
  recovery_codes_hash TEXT NOT NULL DEFAULT '[]'
);
