-- A consultation may start for a visit with no vitals only with a recorded reason.
ALTER TABLE consultations ADD COLUMN vitals_bypass_reason VARCHAR(30)
    CHECK (vitals_bypass_reason IS NULL OR vitals_bypass_reason IN ('EMERGENCY', 'FOLLOW_UP_NO_CHANGE', 'OTHER'));
ALTER TABLE consultations ADD COLUMN vitals_bypass_note VARCHAR(300);
