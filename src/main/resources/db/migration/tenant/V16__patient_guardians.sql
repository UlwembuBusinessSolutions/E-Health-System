-- PREG guardian/companion contact — for a minor, or any patient travelling
-- with someone who may need to be reached or act on their behalf. Deleteable
-- (unlike patients.patient_documents, deliberately append-only), since this
-- is current contact info, not an audit trail: a wrong entry gets removed
-- and re-added, not amended in place.
CREATE TABLE patient_guardians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    relationship VARCHAR(20) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    id_number VARCHAR(13),
    -- Consent-to-act signature — optional and captured separately from the
    -- guardian's own row (drawn after the guardian record already exists),
    -- same "private object, presigned URL only" handling as
    -- patient_documents.s3_key; consented_at is null until one is captured.
    signature_s3_key VARCHAR(500),
    consented_at TIMESTAMPTZ,
    created_by_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_patient_guardians_patient ON patient_guardians (patient_id);
