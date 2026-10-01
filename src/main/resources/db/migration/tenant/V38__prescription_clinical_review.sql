-- Historical supplies are not evidence of a recorded clinical review.
ALTER TABLE prescription_items ADD COLUMN product_id UUID REFERENCES pharmacy_products(id);
ALTER TABLE prescription_items ADD COLUMN clinical_check_status VARCHAR(20) NOT NULL DEFAULT 'REVIEW_REQUIRED';
ALTER TABLE prescription_items ADD COLUMN clinical_check_note VARCHAR(500);
ALTER TABLE prescription_items ADD COLUMN reviewed_by UUID;
ALTER TABLE prescription_items ADD COLUMN reviewed_at TIMESTAMPTZ;
ALTER TABLE prescription_items ADD CONSTRAINT prescription_clinical_status_valid
    CHECK (clinical_check_status IN ('REVIEW_REQUIRED', 'PASSED'));
ALTER TABLE prescription_items ADD CONSTRAINT prescription_clearance_requires_product
    CHECK (clinical_check_status <> 'PASSED' OR product_id IS NOT NULL);
