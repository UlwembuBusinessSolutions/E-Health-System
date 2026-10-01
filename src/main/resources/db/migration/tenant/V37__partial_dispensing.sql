ALTER TABLE prescription_items ADD COLUMN dispensed_quantity INTEGER NOT NULL DEFAULT 0;
UPDATE prescription_items SET dispensed_quantity = quantity WHERE status = 'DISPENSED';
ALTER TABLE prescription_items ADD CONSTRAINT prescription_dispensed_quantity_valid
    CHECK (dispensed_quantity >= 0 AND dispensed_quantity <= quantity);
