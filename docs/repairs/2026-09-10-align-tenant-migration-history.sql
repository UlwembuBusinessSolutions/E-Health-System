-- One-time correction for the verified legacy numbering in local ulwembus.
-- Back up all tenant flyway_schema_history tables before execution.
-- No checksum, installed rank, timestamp or application data is changed.
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE migration_version_mapping (old_version text, new_version text, old_script text, new_script text, checksum integer) ON COMMIT DROP;
INSERT INTO migration_version_mapping VALUES
    ('15', '21', 'V15__pharmacy_named_patient_dispensing.sql', 'V21__pharmacy_named_patient_dispensing.sql', 1612125002),
    ('16', '20', 'V16__pharmacy_stock_movements.sql', 'V20__pharmacy_stock_movements.sql', -2001493397),
    ('17', '19', 'V17__triage_assessments.sql', 'V19__triage_assessments.sql', -617624166),
    ('19', '15', 'V19__patient_passport_number.sql', 'V15__patient_passport_number.sql', 485172852),
    ('20', '16', 'V20__patient_deceased.sql', 'V16__patient_deceased.sql', 846339614),
    ('21', '17', 'V21__audit_log_filter_indexes.sql', 'V17__audit_log_filter_indexes.sql', 1895344119),
    ('22', '18', 'V22__audit_log_privileged.sql', 'V18__audit_log_privileged.sql', -2048145908);
DO $repair$
DECLARE tenant record; matched integer; changed integer;
BEGIN
    IF current_database() <> 'ulwembus' THEN RAISE EXCEPTION 'This repair is scoped to ulwembus'; END IF;
    FOR tenant IN SELECT schema_name FROM control.organizations ORDER BY schema_name LOOP
        EXECUTE format('LOCK TABLE %I.flyway_schema_history IN EXCLUSIVE MODE', tenant.schema_name);
        EXECUTE format('SELECT count(*) FROM %I.flyway_schema_history h JOIN migration_version_mapping m ON h.version = m.old_version AND h.script = m.old_script AND h.checksum = m.checksum WHERE h.success', tenant.schema_name) INTO matched;
        IF matched <> 7 THEN RAISE EXCEPTION 'Unexpected history in %, matched % of 7; all changes rolled back', tenant.schema_name, matched; END IF;
        EXECUTE format('UPDATE %I.flyway_schema_history h SET version = m.new_version, script = m.new_script FROM migration_version_mapping m WHERE h.version = m.old_version AND h.script = m.old_script AND h.checksum = m.checksum AND h.success', tenant.schema_name);
        GET DIAGNOSTICS changed = ROW_COUNT;
        IF changed <> 7 THEN RAISE EXCEPTION 'Unexpected update count in %', tenant.schema_name; END IF;
        RAISE NOTICE 'Aligned % migration history rows in %', changed, tenant.schema_name;
    END LOOP;
END $repair$;
COMMIT;
