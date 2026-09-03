-- The single audit trail every module writes to via AuditLogService.append()
-- — no module constructs a row here directly. before_value/after_value hold
-- a full snapshot (not a diff) so a reviewer never has to reconstruct state
-- from a chain of partial changes.
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    facility_id UUID REFERENCES facilities(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    before_value JSONB,
    after_value JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_user_id ON audit_log(user_id);
CREATE INDEX audit_log_entity ON audit_log(entity_type, entity_id);
