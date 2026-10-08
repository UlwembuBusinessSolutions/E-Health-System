-- Staff qualification/registration/other documents — same shape as
-- V15__patient_documents_and_passport.sql's own patient_documents table:
-- one row per upload, not one slot per document_type, so a renewed
-- registration certificate or an updated CV is a new row, never an
-- overwrite (unlike StaffPhotoService's deterministic S3 key). Multiple
-- rows per staff member per document_type are allowed on purpose.
CREATE TABLE staff_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    document_type VARCHAR(30) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    s3_key VARCHAR(500) NOT NULL,
    uploaded_by_user_id UUID,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_documents_user ON staff_documents (user_id);
