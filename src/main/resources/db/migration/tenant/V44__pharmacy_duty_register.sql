CREATE TABLE pharmacy_duty_entries (
 id UUID PRIMARY KEY,
 facility_id UUID NOT NULL REFERENCES facilities(id),
 staff_id UUID NOT NULL REFERENCES users(id),
 staff_name VARCHAR(210) NOT NULL,
 duty_type VARCHAR(20) NOT NULL CHECK (duty_type IN ('ON_DUTY','NO_DISPENSER')),
 started_at TIMESTAMPTZ NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 ended_at TIMESTAMPTZ,
 reason VARCHAR(500) NOT NULL,
 CHECK (expires_at > started_at)
);
CREATE INDEX idx_pharmacy_duty_active ON pharmacy_duty_entries(facility_id, expires_at) WHERE ended_at IS NULL;
ALTER TABLE dispensing_records ADD COLUMN duty_entry_id UUID REFERENCES pharmacy_duty_entries(id);

