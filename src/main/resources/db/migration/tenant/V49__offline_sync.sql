-- Server-side truth for "what happened to this offline-captured record".
-- client_record_id UNIQUE is the idempotency key: a retried batch returns the
-- original outcome instead of creating a duplicate patient. payload keeps the
-- submitted registration so a CONFLICT/REJECTED record can be resolved or
-- corrected without the device resending it. It holds PII (ID number), so it
-- lives in the tenant schema like every other clinical table.
CREATE TABLE offline_sync_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_record_id UUID NOT NULL UNIQUE,
    device_id VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    conflict_type VARCHAR(30),
    message VARCHAR(500),
    payload JSONB NOT NULL,
    patient_id UUID REFERENCES patients(id),
    conflicting_patient_id UUID REFERENCES patients(id),
    captured_at TIMESTAMPTZ NOT NULL,
    submitted_by_user_id UUID NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    resolution VARCHAR(30),
    resolution_reason TEXT,
    resolved_by_user_id UUID,
    resolved_at TIMESTAMPTZ
);

-- The only list query: open issues awaiting a human.
CREATE INDEX idx_offline_sync_open ON offline_sync_records(status)
    WHERE status IN ('CONFLICT', 'REJECTED');

-- created_at stays server time; this preserves when the nurse actually
-- registered the patient (clinically and audit relevant). Nullable: every
-- existing patient, and every online registration, leaves it NULL.
ALTER TABLE patients ADD COLUMN captured_offline_at TIMESTAMPTZ;