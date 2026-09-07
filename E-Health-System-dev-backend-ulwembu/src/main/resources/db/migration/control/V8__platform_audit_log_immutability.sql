-- AUDT-US-005
-- Make the platform audit log append-only and tamper-resistant.
--
-- The application has no update/delete API for audit records and
-- PlatformAuditLog is Hibernate @Immutable. These database triggers
-- provide the authoritative enforcement boundary as well.
--
-- INSERT remains permitted because platform services legitimately
-- create audit records.
-- SELECT remains permitted.
-- UPDATE / DELETE / TRUNCATE are prohibited.

CREATE OR REPLACE FUNCTION control.platform_audit_log_reject_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'platform_audit_log is append-only: % operation is prohibited',
        TG_OP
        USING ERRCODE = '42501';

    RETURN NULL;
END;
$$;


CREATE TRIGGER platform_audit_log_reject_update_delete_trigger
BEFORE UPDATE OR DELETE ON control.platform_audit_log
FOR EACH ROW
EXECUTE FUNCTION control.platform_audit_log_reject_mutation();


CREATE TRIGGER platform_audit_log_reject_truncate_trigger
BEFORE TRUNCATE ON control.platform_audit_log
FOR EACH STATEMENT
EXECUTE FUNCTION control.platform_audit_log_reject_mutation();
