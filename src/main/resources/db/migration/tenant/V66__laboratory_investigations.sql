CREATE TABLE laboratory_investigations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits(id),
    investigation_date DATE NOT NULL,
    test_name VARCHAR(200) NOT NULL,
    test_results TEXT NOT NULL,
    signed_by_user_id UUID NOT NULL,
    signed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (length(trim(test_name)) > 0),
    CHECK (length(trim(test_results)) > 0)
);

CREATE INDEX idx_laboratory_investigations_visit_date
    ON laboratory_investigations(visit_id, investigation_date DESC, created_at DESC);
