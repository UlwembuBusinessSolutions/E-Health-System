CREATE TABLE visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    facility_id UUID NOT NULL REFERENCES facilities(id),
    visit_type VARCHAR(20) NOT NULL,
    service_stream VARCHAR(30) NOT NULL,
    visit_datetime TIMESTAMPTZ NOT NULL,
    created_by_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_visits_patient ON visits(patient_id);

CREATE TABLE queue_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits(id),
    facility_id UUID NOT NULL REFERENCES facilities(id),
    token_number INT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    status VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
    is_manual BOOLEAN NOT NULL DEFAULT FALSE,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    called_at TIMESTAMPTZ,
    issued_by_user_id UUID
);

-- QueueService's two hot paths: "how many tokens today at this facility"
-- (numbering) and "the active queue for this facility" (list + call-next).
CREATE INDEX idx_queue_tokens_facility_issued ON queue_tokens(facility_id, issued_at);
CREATE INDEX idx_queue_tokens_facility_status ON queue_tokens(facility_id, status);
