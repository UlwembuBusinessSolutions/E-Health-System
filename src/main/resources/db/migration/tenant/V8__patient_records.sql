-- Patient records table — immutable clinical records, never physically deleted.
-- Compliance requirement BR-PREG-150: The legal clinical and audit trail must be
-- preserved in full. Records transition from ACTIVE to ARCHIVED only; no DELETE.
-- 
-- This table lives in the tenant schema (each organization has its own patient data),
-- not the control schema. TenantContext routes queries to the correct schema.

CREATE TABLE patient_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mrn VARCHAR(50) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    archived_at TIMESTAMPTZ,
    archived_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
-- 1. Status filter — find all ACTIVE or ARCHIVED records quickly
CREATE INDEX idx_patient_records_status ON patient_records(status);

-- 2. MRN lookup — primary identifier, frequent exact match
CREATE INDEX idx_patient_records_mrn ON patient_records(mrn);

-- 3. Compliance audit query — "which records did this admin archive?"
CREATE INDEX idx_patient_records_archived_by ON patient_records(archived_by) WHERE status = 'ARCHIVED';

-- 4. Created timestamp — for ordering/pagination (added when pagination comes)
CREATE INDEX idx_patient_records_created_at ON patient_records(created_at DESC);

-- 5. Name search — case-insensitive substring match in searchActiveByName()
CREATE INDEX idx_patient_records_name_lower ON patient_records(
    LOWER(first_name), LOWER(last_name)
) WHERE status = 'ACTIVE';
