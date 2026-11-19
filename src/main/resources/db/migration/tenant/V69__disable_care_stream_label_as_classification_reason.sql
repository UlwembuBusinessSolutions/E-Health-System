-- Acute Episodic Care is the GENERAL care-stream label, not a reason a
-- clinician should select. Keep its row so any existing draft selection
-- remains visible as inactive, and make Minor Ailments the first reason.
UPDATE classification_reasons
SET active = FALSE
WHERE service_stream = 'GENERAL' AND reason_code = 'ACUTE_EPISODIC_CARE';

UPDATE classification_reasons
SET sort_order = 1
WHERE service_stream = 'GENERAL' AND reason_code = 'MINOR_AILMENTS';
