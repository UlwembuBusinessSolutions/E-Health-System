-- PREG-US-017 AC2 ("only archiving is available — never deletion") and
-- PREG-US-018 ("archive a deceased patient record") — a patient row is
-- never deleted (PatientRepository still has no delete method at all), only
-- flagged archived. deceased_date is optional and independent of
-- archived_reason's free text — PREG-US-018 specifically wants "mark
-- deceased with a date", but this doubles as a general withdraw-from-active-use
-- mechanism (moved away, duplicate record, patient request, etc.), not only
-- the deceased case, so the date column stays nullable rather than forcing
-- every archive through a "deceased" framing.
ALTER TABLE patients ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE patients ADD COLUMN archived_reason TEXT;
ALTER TABLE patients ADD COLUMN archived_at TIMESTAMPTZ;
ALTER TABLE patients ADD COLUMN archived_by_user_id UUID;
ALTER TABLE patients ADD COLUMN deceased_date DATE;

-- PatientRepository.findFiltered()/search() both exclude archived patients
-- by default (PREG-US-018 AC1's own "removed from active operational
-- lists") — this index makes that predicate cheap on what will otherwise be
-- every roster/search query going forward.
CREATE INDEX idx_patients_archived ON patients (archived);
