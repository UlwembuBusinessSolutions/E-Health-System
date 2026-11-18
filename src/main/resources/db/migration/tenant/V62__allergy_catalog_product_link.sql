ALTER TABLE patient_allergies
    ADD COLUMN catalog_product_id UUID REFERENCES pharmacy_products (id);

ALTER TABLE patient_allergies
    DROP CONSTRAINT chk_patient_allergy_atc;

ALTER TABLE patient_allergies
    ADD CONSTRAINT chk_patient_allergy_atc CHECK (
        allergen_type <> 'MEDICATION'
        OR allergy_code ~ '^[A-Z][0-9]{2}[A-Z]{2}([A-Z0-9]{1,2})?$'
        OR catalog_product_id IS NOT NULL
    );

CREATE INDEX idx_patient_allergies_catalog_product
    ON patient_allergies (catalog_product_id)
    WHERE catalog_product_id IS NOT NULL;
