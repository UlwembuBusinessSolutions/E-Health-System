-- Patient supply coverage is separate from the physical batch expiry date.
-- Historical coverage is unknown and is deliberately not guessed from free-text dosage.
CREATE TABLE prescription_supplies (
    id UUID PRIMARY KEY,
    prescription_item_id UUID NOT NULL REFERENCES prescription_items(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    product_id UUID NOT NULL REFERENCES pharmacy_products(id),
    facility_id UUID NOT NULL REFERENCES facilities(id),
    dispensed_by UUID NOT NULL,
    dispensed_at TIMESTAMPTZ NOT NULL,
    supply_until DATE NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0)
);
CREATE INDEX prescription_supplies_patient_product ON prescription_supplies(patient_id, product_id, supply_until);

ALTER TABLE prescription_items ADD COLUMN decline_reason VARCHAR(40);
ALTER TABLE prescription_items ADD COLUMN decline_note VARCHAR(500);
ALTER TABLE prescription_items ADD COLUMN declined_by UUID;
ALTER TABLE prescription_items ADD COLUMN declined_at TIMESTAMPTZ;
ALTER TABLE prescription_items ADD CONSTRAINT prescription_decline_details CHECK (
    (status = 'DECLINED' AND decline_reason IS NOT NULL AND declined_by IS NOT NULL AND declined_at IS NOT NULL)
    OR (status <> 'DECLINED' AND decline_reason IS NULL AND decline_note IS NULL AND declined_by IS NULL AND declined_at IS NULL)
);
ALTER TABLE prescription_items ADD CONSTRAINT prescription_decline_reason CHECK (
    decline_reason IN ('SUFFICIENT_MEDICATION', 'DUPLICATE_THERAPY', 'CONTRAINDICATION', 'INTERACTION', 'DOSAGE_CONCERN', 'OTHER')
);
ALTER TABLE prescription_items ADD CONSTRAINT prescription_decline_other_note CHECK (
    decline_reason <> 'OTHER' OR (decline_note IS NOT NULL AND length(trim(decline_note)) > 0)
);
