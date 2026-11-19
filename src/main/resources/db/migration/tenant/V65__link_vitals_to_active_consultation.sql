ALTER TABLE triage_assessments
    ADD COLUMN consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL;

CREATE INDEX idx_triage_assessments_consultation
    ON triage_assessments(consultation_id)
    WHERE consultation_id IS NOT NULL;
