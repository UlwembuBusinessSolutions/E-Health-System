-- V15__patient_passport_number.sql
ALTER TABLE patients ALTER COLUMN id_number DROP NOT NULL;
ALTER TABLE patients ADD COLUMN passport_number VARCHAR(20) UNIQUE;
ALTER TABLE patients ADD CONSTRAINT patients_identity_present
    CHECK (id_number IS NOT NULL OR passport_number IS NOT NULL);