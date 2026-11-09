-- Keep staff and patient booking identities separate; patient account IDs must
-- never be stored in the users foreign key.
ALTER TABLE appointments ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE appointments
    ADD COLUMN created_by_patient_account_id UUID REFERENCES patient_accounts(id),
    ADD COLUMN service_code VARCHAR(40) NOT NULL DEFAULT 'GENERAL_CONSULTATION';

ALTER TABLE appointments
    ADD CONSTRAINT appointments_exactly_one_creator
        CHECK ((created_by IS NOT NULL) <> (created_by_patient_account_id IS NOT NULL));
