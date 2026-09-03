-- SADM-US-010's own acceptance criteria requires MODULE_TOGGLED to capture
-- which module and its previous/new state, not just "something changed" —
-- control.platform_audit_log had no free-text column to hold that until
-- now. Nullable: every action recorded before this migration, and most
-- actions after it (ORGANIZATION_SUSPENDED, PLATFORM_OPERATOR_CREATED,
-- ...), still say everything they need to in the action code alone.
ALTER TABLE control.platform_audit_log
    ADD COLUMN detail VARCHAR(500);
