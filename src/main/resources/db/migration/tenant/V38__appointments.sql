ALTER TABLE facilities ADD COLUMN daily_appointment_limit INTEGER
    CHECK (daily_appointment_limit IS NULL OR daily_appointment_limit > 0);

CREATE TABLE appointments (
    id UUID PRIMARY KEY,
    facility_id UUID NOT NULL REFERENCES facilities(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'CANCELLED')),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    cancel_reason VARCHAR(500),
    version BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_appointments_diary ON appointments(facility_id, appointment_date, appointment_time);
CREATE INDEX idx_appointments_capacity ON appointments(facility_id, appointment_date) WHERE status <> 'CANCELLED';
