-- Preserve unknown values on historical assessments.
ALTER TABLE triage_assessments
    ADD COLUMN trauma_present BOOLEAN,
    ADD COLUMN weight_kg DOUBLE PRECISION,
    ADD COLUMN height_cm DOUBLE PRECISION,
    ADD COLUMN glucose_mmol_l DOUBLE PRECISION,
    ADD COLUMN haemoglobin_gdl DOUBLE PRECISION,
    ADD COLUMN urine_protein VARCHAR(20),
    ADD COLUMN urine_glucose VARCHAR(20),
    ADD COLUMN urine_ketones VARCHAR(20),
    ADD COLUMN urine_blood VARCHAR(20),
    ADD COLUMN urine_leukocytes VARCHAR(20),
    ADD COLUMN urine_nitrites VARCHAR(20),
    ADD COLUMN pregnancy_test VARCHAR(20);
