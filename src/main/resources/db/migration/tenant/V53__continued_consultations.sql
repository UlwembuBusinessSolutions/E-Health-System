-- A consultation can carry on from an earlier signed one for the same episode of care, for example when
-- the patient was sent to another facility and comes back to the doctor on a new visit. The earlier
-- record stays as it was; this one starts from a copy of its notes and diagnoses.
ALTER TABLE consultations ADD COLUMN continued_from_consultation_id UUID REFERENCES consultations (id);
CREATE INDEX idx_consultations_continued_from ON consultations (continued_from_consultation_id)
    WHERE continued_from_consultation_id IS NOT NULL;
