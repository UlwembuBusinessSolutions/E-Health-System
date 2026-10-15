-- Supplementary identity fields, additive to the existing idNumber-driven
-- flow (PatientService.register() still requires idNumber and still derives
-- dateOfBirth/gender/citizenshipStatus from it — see SouthAfricanIdNumber's
-- own why-note). A patient who also holds a passport can have it recorded
-- alongside their SA ID, e.g. for medical aid claims that ask for one; this
-- does not build the separate passport-only/no-SA-ID registration flow
-- CitizenshipStatus's own class comment flags as Blocked/Not Ready (BRD Open
-- Item OI-009) — that would mean making id_number itself optional and
-- deriving nothing, a materially different feature.
ALTER TABLE patients ADD COLUMN passport_number VARCHAR(20);
ALTER TABLE patients ADD COLUMN passport_expiry DATE;

-- PREG-US-017's "impossible to delete" reasoning doesn't extend to
-- documents the same way — unlike the demographic record itself, a
-- rescanned ID or renewed medical aid card is expected to be re-uploaded
-- over time, so this deliberately allows multiple rows per patient per
-- document_type rather than one slot each; PatientController lists all of
-- them, newest first.
CREATE TABLE patient_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    document_type VARCHAR(20) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    s3_key VARCHAR(500) NOT NULL,
    uploaded_by_user_id UUID,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_patient_documents_patient ON patient_documents (patient_id);
