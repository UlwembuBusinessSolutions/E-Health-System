ALTER TABLE dispensing_records ADD COLUMN coverage_until DATE;
CREATE INDEX idx_dispensing_records_patient_coverage ON dispensing_records(patient_id, coverage_until);

CREATE TABLE prescription_declines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL UNIQUE REFERENCES prescriptions(id),
    facility_id UUID NOT NULL REFERENCES facilities(id),
    pharmacist_id UUID NOT NULL,
    prescriber_id UUID NOT NULL,
    reason_code VARCHAR(40) NOT NULL,
    reason_detail VARCHAR(1000),
    declined_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE prescription_decline_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decline_id UUID NOT NULL REFERENCES prescription_declines(id),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id),
    recipient_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_decline_notifications_recipient ON prescription_decline_notifications(recipient_user_id, created_at DESC);
