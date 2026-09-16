CREATE TABLE drug_safety_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_type VARCHAR(30) NOT NULL CHECK (rule_type IN ('DRUG_INTERACTION', 'CONTRAINDICATION')),
    drug_name VARCHAR(200) NOT NULL,
    related_drug_name VARCHAR(200),
    clinical_term VARCHAR(200),
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('LOW', 'MODERATE', 'HIGH', 'CRITICAL')),
    message VARCHAR(1000) NOT NULL,
    CHECK ((rule_type = 'DRUG_INTERACTION' AND related_drug_name IS NOT NULL AND clinical_term IS NULL)
        OR (rule_type = 'CONTRAINDICATION' AND clinical_term IS NOT NULL AND related_drug_name IS NULL))
);
CREATE TABLE patient_clinical_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    fact_type VARCHAR(20) NOT NULL CHECK (fact_type IN ('ALLERGY', 'CONDITION')),
    term VARCHAR(200) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(patient_id, fact_type, term)
);
CREATE INDEX idx_patient_clinical_facts_patient ON patient_clinical_facts(patient_id);
