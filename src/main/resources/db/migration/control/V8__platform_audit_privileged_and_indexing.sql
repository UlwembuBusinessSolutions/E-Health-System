-- BR-AUDT-030 & BR-AUDT-050: Privileged flag and performance indexing for platform audit log.
ALTER TABLE control.platform_audit_log
    ADD COLUMN privileged BOOLEAN NOT NULL DEFAULT TRUE;

CREATE OR REPLACE FUNCTION control.platform_audit_log_set_integrity_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    prior_hash VARCHAR(64);
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext(TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME));

    SELECT entry_hash INTO prior_hash
    FROM control.platform_audit_log
    WHERE entry_hash IS NOT NULL
    ORDER BY chain_sequence DESC
    LIMIT 1;

    NEW.previous_hash := prior_hash;
    NEW.entry_hash := encode(digest(
        jsonb_build_object(
            'id', NEW.id,
            'chainSequence', NEW.chain_sequence,
            'previousHash', NEW.previous_hash,
            'platformOperatorId', NEW.platform_operator_id,
            'action', NEW.action,
            'organizationId', NEW.organization_id,
            'detail', NEW.detail,
            'ipAddress', NEW.ip_address,
            'deviceSignature', NEW.device_signature,
            'privileged', NEW.privileged,
            'createdAt', NEW.created_at
        )::text,
        'sha256'), 'hex');
    RETURN NEW;
END;
$$;

-- Performance indexing for BR-AUDT-050: Sub-5-second querying on high volume
CREATE INDEX IF NOT EXISTS idx_platform_audit_created_at ON control.platform_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_filters ON control.platform_audit_log (action, organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_privileged ON control.platform_audit_log (privileged);
