-- A patient's own self-service portal login — see
-- patient/PatientAccount.java for why this is a separate table from
-- patients rather than new columns on it. patient_id is nullable and has
-- no FK constraint enforced at the DB level (a signup can exist before any
-- Patient row does); id_number is the reconciliation key both this table
-- and patients key off, and is unique per tenant on each side independently.
CREATE TABLE patient_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients (id),
    id_number VARCHAR(13) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    failed_login_count INTEGER NOT NULL DEFAULT 0,
    last_failed_login_at TIMESTAMPTZ,
    locked_at TIMESTAMPTZ,
    token_version INTEGER NOT NULL DEFAULT 0,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
