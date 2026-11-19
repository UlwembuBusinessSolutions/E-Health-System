CREATE TABLE art_longitudinal_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits(id),
    record_date DATE NOT NULL,
    duration_on_art VARCHAR(200),
    stage VARCHAR(20) NOT NULL CHECK (stage IN ('STAGE_1', 'STAGE_2', 'STAGE_3', 'STAGE_4')),
    viral_load VARCHAR(200),
    cd4_count VARCHAR(200),
    stage_description TEXT,
    signed_by_user_id UUID NOT NULL,
    signed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_art_longitudinal_records_visit_date
    ON art_longitudinal_records(visit_id, record_date DESC, created_at DESC);
