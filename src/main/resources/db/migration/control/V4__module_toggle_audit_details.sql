ALTER TABLE control.platform_audit_log
    ADD COLUMN module_code VARCHAR(20),
    ADD COLUMN previous_enabled BOOLEAN,
    ADD COLUMN new_enabled BOOLEAN;
