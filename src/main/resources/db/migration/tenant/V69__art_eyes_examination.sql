CREATE TABLE art_eyes_examinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL UNIQUE REFERENCES visits(id),
    result VARCHAR(20) NOT NULL CHECK (result IN ('NORMAL', 'ABNORMAL')),
    recorded_by_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
