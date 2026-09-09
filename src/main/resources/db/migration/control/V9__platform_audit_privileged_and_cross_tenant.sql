ALTER TABLE control.platform_audit_log ADD COLUMN privileged BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE control.platform_audit_log ALTER COLUMN platform_operator_id DROP NOT NULL;