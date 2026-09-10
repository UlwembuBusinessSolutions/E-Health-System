CREATE TABLE triage_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits(id),
    respiratory_rate INT NOT NULL,
    pulse_rate INT NOT NULL,
    systolic_bp INT NOT NULL,
    temperature NUMERIC(4,1) NOT NULL,
    avpu VARCHAR(20) NOT NULL,
    mobility VARCHAR(20) NOT NULL,
    trauma BOOLEAN NOT NULL,
    deceased BOOLEAN NOT NULL,
    tews_score INT NOT NULL,
    calculated_colour VARCHAR(10) NOT NULL,
    assigned_colour VARCHAR(10) NOT NULL,
    sla_minutes INT,
    override_reason VARCHAR(500),
    recorded_by_user_id UUID,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_triage_assessments_visit ON triage_assessments(visit_id, recorded_at DESC);
