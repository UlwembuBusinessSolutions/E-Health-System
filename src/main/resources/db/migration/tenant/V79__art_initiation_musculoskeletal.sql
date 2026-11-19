CREATE TABLE art_initiation_musculoskeletal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL UNIQUE REFERENCES visits(id),
    finding VARCHAR(10) CHECK (finding IS NULL OR finding IN ('NORMAL', 'ABNORMAL')),
    comment TEXT,
    created_by_user_id UUID NOT NULL,
    updated_by_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
