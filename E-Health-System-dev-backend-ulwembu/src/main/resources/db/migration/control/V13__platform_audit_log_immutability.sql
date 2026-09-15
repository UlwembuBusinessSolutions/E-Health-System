-- AUDT-US-005
-- Make the platform audit log append-only and tamper-resistant.
--
-- INSERT remains permitted.
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