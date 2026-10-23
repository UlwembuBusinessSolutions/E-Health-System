-- EP-10 PHRM / PHRM-F03: tenant-isolated SYNCH master-list cache and parcel tracing.
CREATE TABLE ccmdd_pickup_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    synch_id VARCHAR(120) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    province VARCHAR(120) NOT NULL DEFAULT '',
    district VARCHAR(120) NOT NULL DEFAULT '',
    area VARCHAR(150) NOT NULL DEFAULT '',
    address VARCHAR(500) NOT NULL DEFAULT '',
    contact_email VARCHAR(255),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    synced_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_ccmdd_pickup_location ON ccmdd_pickup_points(province, district, area);
CREATE TABLE ccmdd_synch_state (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    last_success TIMESTAMPTZ,
    last_attempt TIMESTAMPTZ,
    last_error VARCHAR(500)
);
INSERT INTO ccmdd_synch_state (id) VALUES (1);
CREATE TABLE ccmdd_parcels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id),
    facility_id UUID NOT NULL REFERENCES facilities(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    pickup_point_id UUID NOT NULL REFERENCES ccmdd_pickup_points(id),
    tracking_reference VARCHAR(60) NOT NULL UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'DISPATCHED'
        CHECK (status IN ('DISPATCHED', 'READY', 'COLLECTED', 'RETURNED')),
    dispatched_at TIMESTAMPTZ NOT NULL,
    ready_at TIMESTAMPTZ,
    collected_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    trace_due_at TIMESTAMPTZ NOT NULL,
    tracing_days INT NOT NULL CHECK (tracing_days BETWEEN 1 AND 90),
    notified_at TIMESTAMPTZ,
    notification_status VARCHAR(30) NOT NULL DEFAULT 'NOT_CONFIGURED'
        CHECK (notification_status IN ('NOT_CONFIGURED', 'QUEUED', 'FAILED')),
    notification_error VARCHAR(500),
    trace_attempts INT NOT NULL DEFAULT 0 CHECK (trace_attempts >= 0),
    last_traced_at TIMESTAMPTZ,
    trace_note VARCHAR(1000),
    created_by UUID NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_ccmdd_active_prescription UNIQUE (prescription_id)
);
CREATE INDEX idx_ccmdd_parcels_facility_dispatch ON ccmdd_parcels(facility_id, dispatched_at DESC);
CREATE INDEX idx_ccmdd_parcels_tracing ON ccmdd_parcels(facility_id, trace_due_at)
    WHERE status IN ('DISPATCHED', 'READY');
