CREATE TABLE art_initiation_longitudinal_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits(id),
    record_date DATE NOT NULL,
    duration_on_art_months INTEGER CHECK (duration_on_art_months >= 0),
    stage VARCHAR(20) NOT NULL CHECK (stage IN ('STAGE_1', 'STAGE_2', 'STAGE_3', 'STAGE_4')),
    patient_weight_kg NUMERIC(6, 2) CHECK (patient_weight_kg > 0),
    viral_load VARCHAR(200),
    cd4_count VARCHAR(200),
    stage_description TEXT,
    recorded_by_user_id UUID NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_art_initiation_longitudinal_visit_date
    ON art_initiation_longitudinal_records(visit_id, record_date DESC, recorded_at DESC);
