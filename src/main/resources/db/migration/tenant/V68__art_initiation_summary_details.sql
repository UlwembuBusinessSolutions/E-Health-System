CREATE TABLE art_initiation_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL UNIQUE REFERENCES visits(id),
    art_start_date DATE,
    hiv_diagnosis_year INTEGER CHECK (hiv_diagnosis_year IS NULL OR hiv_diagnosis_year >= 1980),
    prior_therapy VARCHAR(20) CHECK (prior_therapy IS NULL OR prior_therapy IN ('NONE', 'PMTCT', 'HAART', 'PEP')),
    details TEXT,
    created_by_user_id UUID NOT NULL,
    updated_by_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
