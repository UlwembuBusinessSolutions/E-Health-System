CREATE TABLE prescription_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id),
    facility_id UUID NOT NULL REFERENCES facilities(id),
    raised_by_user_id UUID NOT NULL,
    prescriber_id UUID NOT NULL,
    reason VARCHAR(2000) NOT NULL,
    guideline_warning VARCHAR(4000),
    status VARCHAR(20) NOT NULL CHECK (status IN ('OPEN', 'RESPONDED')),
    prescriber_response VARCHAR(2000),
    raised_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at TIMESTAMPTZ
);
CREATE INDEX idx_prescription_queries_facility_raised ON prescription_queries(facility_id, raised_at DESC);
CREATE INDEX idx_prescription_queries_prescription_status ON prescription_queries(prescription_id, status);

CREATE TABLE prescription_query_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID NOT NULL REFERENCES prescription_queries(id),
    recipient_user_id UUID NOT NULL,
    type VARCHAR(40) NOT NULL,
    message VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prescription_query_notifications_recipient_created
    ON prescription_query_notifications(recipient_user_id, created_at DESC);
