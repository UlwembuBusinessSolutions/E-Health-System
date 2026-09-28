-- A failed login attempt against an email with no matching operator row
-- has no real platform_operator_id to attribute it to — logging it at all
-- (rather than staying silent, as today) needs the column to allow null
-- rather than inventing a fake operator id. NULL never satisfies the FK
-- check, so existing rows and the FK constraint itself are unaffected.
ALTER TABLE control.platform_audit_log ALTER COLUMN platform_operator_id DROP NOT NULL;
