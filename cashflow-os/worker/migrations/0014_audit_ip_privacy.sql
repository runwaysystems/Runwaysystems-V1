-- Remove historical network-address material from the admin audit trail.
-- Migration 0009 originally accepted raw CF-Connecting-IP values. The Worker
-- now writes only a domain-separated SHA-256 hash and applies a 365-day audit
-- retention window. Clearing the old column before that code is deployed
-- ensures no legacy raw address survives the transition.
UPDATE admin_audit_log SET ip = '' WHERE ip != '';
