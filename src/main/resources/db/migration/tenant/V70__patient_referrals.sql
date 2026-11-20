CREATE TABLE patient_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    referral_type VARCHAR(20) NOT NULL CHECK (referral_type IN ('REFERRAL', 'TRANSFER')),
    destination_facility_id UUID REFERENCES facilities(id),
    institution_name VARCHAR(200),
    contact_person VARCHAR(160),
    telephone_number VARCHAR(30),
    fax_number VARCHAR(30),
    referral_date DATE NOT NULL,
    reason TEXT,
    clinical_summary TEXT,
    required_medication TEXT,
    medication_instructions TEXT,
    additional_notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'SUBMITTED', 'ACCEPTED', 'COMPLETED', 'CANCELLED')),
    initiated_by_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ
);

CREATE INDEX idx_patient_referrals_patient_date
    ON patient_referrals(patient_id, referral_date DESC, created_at DESC);
CREATE INDEX idx_patient_referrals_status
    ON patient_referrals(status, created_at DESC);

CREATE TABLE patient_referral_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_id UUID NOT NULL REFERENCES patient_referrals(id) ON DELETE CASCADE,
    from_status VARCHAR(20) CHECK (from_status IS NULL OR from_status IN
        ('DRAFT', 'SUBMITTED', 'ACCEPTED', 'COMPLETED', 'CANCELLED')),
    to_status VARCHAR(20) NOT NULL CHECK (to_status IN
        ('DRAFT', 'SUBMITTED', 'ACCEPTED', 'COMPLETED', 'CANCELLED')),
    actor_user_id UUID NOT NULL,
    note VARCHAR(500),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_patient_referral_events_referral
    ON patient_referral_events(referral_id, occurred_at);

CREATE TABLE patient_referral_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_id UUID NOT NULL REFERENCES patient_referrals(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id),
    original_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(150) NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    s3_key VARCHAR(500) NOT NULL UNIQUE,
    uploaded_by_user_id UUID NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_patient_referral_documents_referral
    ON patient_referral_documents(referral_id, uploaded_at DESC);
CREATE INDEX idx_patient_referral_documents_patient
    ON patient_referral_documents(patient_id, uploaded_at DESC);
