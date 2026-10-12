-- Patient portal bookings carry a patient account as the creator; staff
-- bookings continue to carry created_by. Keep both identities explicit so
-- a patient UUID is never placed in the staff users table's foreign key.
ALTER TABLE appointments ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE appointments
    ADD COLUMN created_by_patient_account_id UUID REFERENCES patient_accounts(id),
    ADD COLUMN service_code VARCHAR(40) NOT NULL DEFAULT 'GENERAL_CONSULTATION';

ALTER TABLE appointments
    ADD CONSTRAINT appointments_exactly_one_creator
        CHECK ((created_by IS NOT NULL) <> (created_by_patient_account_id IS NOT NULL));
