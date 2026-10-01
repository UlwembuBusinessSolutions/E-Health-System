-- RECQ-F03 / BR-RECQ-080
-- Automatic patient journey timing from registration through pharmacy.
CREATE TABLE waiting_time_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL UNIQUE REFERENCES visits(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    facility_id UUID NOT NULL REFERENCES facilities(id),

    registration_started_at TIMESTAMPTZ NOT NULL,
    registration_completed_at TIMESTAMPTZ,
    triage_started_at TIMESTAMPTZ,
    triage_completed_at TIMESTAMPTZ,
    consultation_started_at TIMESTAMPTZ,
    consultation_completed_at TIMESTAMPTZ,
    pharmacy_started_at TIMESTAMPTZ,
    pharmacy_completed_at TIMESTAMPTZ,

    total_waiting_minutes BIGINT,
    total_journey_minutes BIGINT,
    exceeds_120_minutes BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_waiting_time_log_facility_started
    ON waiting_time_log(facility_id, registration_started_at);

CREATE INDEX idx_waiting_time_log_patient
    ON waiting_time_log(patient_id);

CREATE INDEX idx_waiting_time_log_exceeds_120
    ON waiting_time_log(exceeds_120_minutes)
    WHERE exceeds_120_minutes = TRUE;
