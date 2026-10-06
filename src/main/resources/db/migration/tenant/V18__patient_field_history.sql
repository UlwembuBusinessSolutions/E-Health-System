-- PREG-US-016 AC1: "the previous value is retained in history and the
-- change is audit-logged" — one row per field actually changed by an
-- update, append-only, never overwritten. mpi_number/id_number/
-- date_of_birth/gender/citizenship_status can never appear as field_name
-- here — Patient has no setter for any of them (see Patient's own
-- why-note), so PatientService.update() can never produce a row for one.
CREATE TABLE patient_field_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    field_name VARCHAR(50) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reason TEXT NOT NULL,
    changed_by_user_id UUID,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_patient_field_history_patient ON patient_field_history (patient_id);
