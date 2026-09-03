CREATE SEQUENCE prescription_serial_seq START WITH 1;

CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number VARCHAR(20) NOT NULL UNIQUE,
    visit_id UUID NOT NULL REFERENCES visits(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    facility_id UUID NOT NULL REFERENCES facilities(id),
    prescriber_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PrescriptionService's dispensing-queue read: pending prescriptions for a
-- facility, oldest first.
CREATE INDEX idx_prescriptions_facility_status ON prescriptions(facility_id, status);

CREATE TABLE prescription_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id),
    drug_name VARCHAR(200) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    quantity INT NOT NULL
);

CREATE INDEX idx_prescription_items_prescription ON prescription_items(prescription_id);

CREATE TABLE dispensing_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL UNIQUE REFERENCES prescriptions(id),
    dispensed_by_user_id UUID NOT NULL,
    dispensed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
