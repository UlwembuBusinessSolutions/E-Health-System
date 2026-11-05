-- Vital Signs user story: the database side of everything the code already reads and writes.
--
-- Your entities already map these columns (TriageAssessment, AdditionalObservations, PharmacyProduct),
-- but no migration created them and spring.jpa.hibernate.ddl-auto is "none", so without this file
-- every triage query and every product query fails with "column ... does not exist".

-- 1. Triage: age at capture (drives the age-specific temperature, respiration and BP rules) and the
--    extra urinalysis / glucose fields.
ALTER TABLE triage_assessments
    ADD COLUMN IF NOT EXISTS age_months_at_capture INTEGER,
    ADD COLUMN IF NOT EXISTS urine_urobilinogen    VARCHAR(30),
    ADD COLUMN IF NOT EXISTS urine_bilirubin       VARCHAR(20),
    ADD COLUMN IF NOT EXISTS urine_ph              DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS glucose_type          VARCHAR(20);

ALTER TABLE triage_assessments
    ADD CONSTRAINT chk_triage_glucose_type
        CHECK (glucose_type IS NULL OR glucose_type IN ('FASTING', 'RANDOM'));

-- 2. Pharmacy products: the ATC code that allergy checking compares (first 5 characters).
--    5 characters is the chemical-subgroup level (e.g. N02BE), 7 is the full substance (N02BE01).
--    The pattern matches the validation in PharmacyProductService.updateAtcCode().
ALTER TABLE pharmacy_products
    ADD COLUMN IF NOT EXISTS atc_code VARCHAR(7);

ALTER TABLE pharmacy_products
    ADD CONSTRAINT chk_pharmacy_products_atc_code
        CHECK (atc_code IS NULL OR atc_code ~ '^[A-Z][0-9]{2}[A-Z]{2}([A-Z0-9]{1,2})?$');

CREATE INDEX IF NOT EXISTS idx_pharmacy_products_atc_group
    ON pharmacy_products (LEFT(atc_code, 5)) WHERE atc_code IS NOT NULL;

-- 3. Which ICD-10 conditions a medicine is used for, so the prescriber can "allow for medicines on the
--    stated ICD-10 codes" (I10 hypertension, E10.9 / E11.9 diabetes, E10.0-E14.0 hypoglycemia).
--    Maintained by the pharmacy on the product screen.
CREATE TABLE IF NOT EXISTS pharmacy_product_indications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID        NOT NULL REFERENCES pharmacy_products (id) ON DELETE CASCADE,
    icd10_code VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_product_indication UNIQUE (product_id, icd10_code),
    CONSTRAINT chk_indication_icd10_format CHECK (icd10_code ~ '^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$')
);

CREATE INDEX IF NOT EXISTS idx_product_indications_code ON pharmacy_product_indications (icd10_code);

-- 4. The diagnosis catalogue already holds I10, E10.9 and E11.9. Add the hypoglycemia codes from the
--    story so a doctor can record them as a diagnosis on the consultation.
INSERT INTO diagnoses (code, name, name_key, source, catalogue_version) VALUES
    ('E10.0', 'Type 1 diabetes mellitus with coma',               'type 1 diabetes mellitus with coma',               'ICD10', 'ICD-10 WHO'),
    ('E11.0', 'Type 2 diabetes mellitus with coma',               'type 2 diabetes mellitus with coma',               'ICD10', 'ICD-10 WHO'),
    ('E12.0', 'Malnutrition-related diabetes mellitus with coma', 'malnutrition-related diabetes mellitus with coma', 'ICD10', 'ICD-10 WHO'),
    ('E13.0', 'Other specified diabetes mellitus with coma',      'other specified diabetes mellitus with coma',      'ICD10', 'ICD-10 WHO'),
    ('E14.0', 'Unspecified diabetes mellitus with coma',          'unspecified diabetes mellitus with coma',          'ICD10', 'ICD-10 WHO')
ON CONFLICT (name_key) DO NOTHING;
