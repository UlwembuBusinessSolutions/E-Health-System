-- ID numbers remain unique when present; multiple patients may have no SA ID.
-- Demographics derived from an ID stay unknown until there is another source.
ALTER TABLE patients
    ALTER COLUMN id_number DROP NOT NULL,
    ALTER COLUMN gender DROP NOT NULL,
    ALTER COLUMN citizenship_status DROP NOT NULL;

ALTER TABLE patient_accounts
    ALTER COLUMN id_number DROP NOT NULL;

ALTER TABLE patient_registration_verifications
    ALTER COLUMN id_number DROP NOT NULL,
    ADD COLUMN date_of_birth DATE;
