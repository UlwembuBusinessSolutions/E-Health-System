-- Match the patient care classification wording and display order.
UPDATE classification_reasons
SET label = 'Acute Episodic Care', sort_order = 1
WHERE service_stream = 'GENERAL' AND reason_code = 'ACUTE_EPISODIC_CARE';

UPDATE classification_reasons
SET label = 'Minor Ailments', sort_order = 2
WHERE service_stream = 'GENERAL' AND reason_code = 'MINOR_AILMENTS';
