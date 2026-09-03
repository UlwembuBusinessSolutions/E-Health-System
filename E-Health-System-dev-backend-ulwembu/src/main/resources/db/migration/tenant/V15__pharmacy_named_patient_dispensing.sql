-- PHRM-US-018: preserve named-patient identity on the actual dispensing
-- event, and retain a durable manual-verification work item when it cannot
-- be verified.  Existing dispensing rows are backfilled through their
-- prescription because the original migration predates this requirement.
ALTER TABLE dispensing_records ADD COLUMN patient_id UUID;
ALTER TABLE dispensing_records ADD COLUMN patient_mpi VARCHAR(20);

UPDATE dispensing_records dr
SET patient_id = p.patient_id,
    patient_mpi = pat.mpi_number
FROM prescriptions p
JOIN patients pat ON pat.id = p.patient_id
WHERE p.id = dr.prescription_id;

ALTER TABLE dispensing_records ALTER COLUMN patient_id SET NOT NULL;
ALTER TABLE dispensing_records ALTER COLUMN patient_mpi SET NOT NULL;
ALTER TABLE dispensing_records
    ADD CONSTRAINT fk_dispensing_records_patient FOREIGN KEY (patient_id) REFERENCES patients(id);

CREATE INDEX idx_dispensing_records_patient ON dispensing_records(patient_id);

CREATE TABLE manual_verification_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL UNIQUE REFERENCES prescriptions(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    reason VARCHAR(300) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_manual_verification_cases_created_at ON manual_verification_cases(created_at);
