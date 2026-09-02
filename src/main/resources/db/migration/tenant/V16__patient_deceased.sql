-- V16__patient_deceased.sql
ALTER TABLE patients
    ADD COLUMN deceased BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN date_of_death DATE,
    ADD COLUMN archived_at TIMESTAMPTZ,
    ADD COLUMN archived_by_user_id UUID;

-- Every list/search read filters on this — keep it cheap.
CREATE INDEX idx_patients_deceased ON patients(deceased);