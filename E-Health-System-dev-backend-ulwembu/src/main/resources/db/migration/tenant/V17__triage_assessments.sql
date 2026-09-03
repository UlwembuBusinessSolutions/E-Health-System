CREATE TABLE triage_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    systolic_bp INT NOT NULL,
    diastolic_bp INT NOT NULL,
    heart_rate INT NOT NULL,
    temperature_celsius NUMERIC(4,1) NOT NULL,
    respiratory_rate INT NOT NULL,
    avpu VARCHAR(20) NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL,
    captured_by_user_id UUID NOT NULL
);

CREATE INDEX idx_triage_assessments_patient_captured_at
    ON triage_assessments(patient_id, captured_at DESC);
