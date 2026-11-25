-- IAM-US (per-tenant role permission customisation): the audit detail now
-- carries full before/after permission sets, which can exceed 500 chars.
-- Widening VARCHAR -> TEXT is lossless for every existing row.
ALTER TABLE control.platform_audit_log ALTER COLUMN detail TYPE TEXT;