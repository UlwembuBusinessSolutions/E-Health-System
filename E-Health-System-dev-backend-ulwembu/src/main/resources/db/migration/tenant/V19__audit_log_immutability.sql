-- AUDT-US-005
-- Make the tenant audit log append-only and tamper-evident.
--
-- audit_sequence gives every row a deterministic position in the chain.
-- previous_hash links a row to its predecessor.
-- integrity_hash commits the row contents and previous_hash.
--
-- PostgreSQL triggers are the database-level enforcement boundary.
-- Application/JPA immutability is an additional defence, not the primary one.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE audit_log
    ADD COLUMN audit_sequence BIGINT GENERATED ALWAYS AS IDENTITY;

ALTER TABLE audit_log
    ADD CONSTRAINT audit_log_audit_sequence_unique
    UNIQUE (audit_sequence);

ALTER TABLE audit_log
    ADD COLUMN previous_hash VARCHAR(64);

ALTER TABLE audit_log
    ADD COLUMN integrity_hash VARCHAR(64);


-- Build a deterministic SHA-256 representation of an audit row.
-- NULL values are represented consistently so the same row always hashes
-- to the same value.

CREATE OR REPLACE FUNCTION audit_log_calculate_hash(
    p_id UUID,
    p_user_id UUID,
    p_facility_id UUID,
    p_action VARCHAR,
    p_entity_type VARCHAR,
    p_entity_id VARCHAR,
    p_before_value JSONB,
    p_after_value JSONB,
    p_ip_address VARCHAR,
    p_created_at TIMESTAMPTZ,
    p_device_signature VARCHAR,
    p_privileged BOOLEAN,
    p_audit_sequence BIGINT,
    p_previous_hash VARCHAR
)
RETURNS VARCHAR(64)
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT encode(
        digest(
            concat_ws(
                '|',
                COALESCE(p_id::text, ''),
                COALESCE(p_user_id::text, ''),
                COALESCE(p_facility_id::text, ''),
                COALESCE(p_action, ''),
                COALESCE(p_entity_type, ''),
                COALESCE(p_entity_id, ''),
                COALESCE(p_before_value::text, ''),
                COALESCE(p_after_value::text, ''),
                COALESCE(p_ip_address, ''),
                COALESCE(p_created_at::text, ''),
                COALESCE(p_device_signature, ''),
                COALESCE(p_privileged::text, ''),
                COALESCE(p_audit_sequence::text, ''),
                COALESCE(p_previous_hash, '')
            ),
            'sha256'
        ),
        'hex'
    );
$$;


-- Existing rows need to be incorporated into the chain.
-- audit_sequence was generated when the column was added, so the existing
-- records already have a deterministic ordering.

DO $$
DECLARE
    audit_row RECORD;
    previous VARCHAR(64);
    calculated VARCHAR(64);
BEGIN
    previous := repeat('0', 64);

    FOR audit_row IN
        SELECT
            id,
            user_id,
            facility_id,
            action,
            entity_type,
            entity_id,
            before_value,
            after_value,
            ip_address,
            created_at,
            device_signature,
            privileged,
            audit_sequence
        FROM audit_log
        ORDER BY audit_sequence
    LOOP
        calculated := audit_log_calculate_hash(
            audit_row.id,
            audit_row.user_id,
            audit_row.facility_id,
            audit_row.action,
            audit_row.entity_type,
            audit_row.entity_id,
            audit_row.before_value,
            audit_row.after_value,
            audit_row.ip_address,
            audit_row.created_at,
            audit_row.device_signature,
            audit_row.privileged,
            audit_row.audit_sequence,
            previous
        );

        UPDATE audit_log
        SET previous_hash = previous,
            integrity_hash = calculated
        WHERE id = audit_row.id;

        previous := calculated;
    END LOOP;
END;
$$;


ALTER TABLE audit_log
    ALTER COLUMN previous_hash SET NOT NULL;

ALTER TABLE audit_log
    ALTER COLUMN integrity_hash SET NOT NULL;


-- INSERT trigger.
--
-- The transaction-level advisory lock serialises audit-chain construction.
-- Without it, two simultaneous INSERTs could both read the same previous
-- row and produce competing branches in the chain.

CREATE OR REPLACE FUNCTION audit_log_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    previous VARCHAR(64);
BEGIN
    PERFORM pg_advisory_xact_lock(
        hashtextextended('audit_log_integrity_chain', 0)
    );

    SELECT integrity_hash
    INTO previous
    FROM audit_log
    ORDER BY audit_sequence DESC
    LIMIT 1;

    if previous IS NULL THEN
        previous := repeat('0', 64);
    END IF;

    NEW.previous_hash := previous;

    NEW.integrity_hash := audit_log_calculate_hash(
        NEW.id,
        NEW.user_id,
        NEW.facility_id,
        NEW.action,
        NEW.entity_type,
        NEW.entity_id,
        NEW.before_value,
        NEW.after_value,
        NEW.ip_address,
        NEW.created_at,
        NEW.device_signature,
        NEW.privileged,
        NEW.audit_sequence,
        NEW.previous_hash
    );

    RETURN NEW;
END;
$$;


-- UPDATE/DELETE/TRUNCATE are never legitimate operations on an audit trail.

CREATE OR REPLACE FUNCTION audit_log_reject_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'audit_log is append-only: % operation is prohibited',
        TG_OP
        USING ERRCODE = '42501';

    RETURN NULL;
END;
$$;


CREATE TRIGGER audit_log_before_insert_trigger
BEFORE INSERT ON audit_log
FOR EACH ROW
EXECUTE FUNCTION audit_log_before_insert();


CREATE TRIGGER audit_log_reject_update_delete_trigger
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW
EXECUTE FUNCTION audit_log_reject_mutation();


CREATE TRIGGER audit_log_reject_truncate_trigger
BEFORE TRUNCATE ON audit_log
FOR EACH STATEMENT
EXECUTE FUNCTION audit_log_reject_mutation();