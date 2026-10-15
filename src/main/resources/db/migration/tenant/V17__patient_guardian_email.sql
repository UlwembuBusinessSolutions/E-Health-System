-- Optional — a guardian is reachable by phone at minimum (contact_number
-- stays required); email is an extra channel, not a replacement for it.
ALTER TABLE patient_guardians ADD COLUMN email VARCHAR(255);
