CREATE TABLE classification_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_stream VARCHAR(30) NOT NULL,
    reason_code VARCHAR(60) NOT NULL,
    label VARCHAR(120) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    UNIQUE (service_stream, reason_code)
);

INSERT INTO classification_reasons (service_stream, reason_code, label, sort_order) VALUES
('GENERAL', 'MINOR_AILMENTS', 'Minor ailments', 1),
('GENERAL', 'ACUTE_EPISODIC_CARE', 'Acute episodic care', 2),
('CHRONIC_CARE', 'ART', 'ART', 1),
('CHRONIC_CARE', 'HYPERTENSION', 'Hypertension', 2),
('CHRONIC_CARE', 'DIABETES', 'Diabetes', 3),
('MATERNAL_CHILD', 'ANTENATAL_CARE', 'Antenatal care', 1),
('MATERNAL_CHILD', 'CHILD_HEALTH', 'Child health', 2),
('OCCUPATIONAL_HEALTH', 'OCCUPATIONAL_ASSESSMENT', 'Occupational assessment', 1);

CREATE TABLE consultation_classification_reasons (
    consultation_id UUID NOT NULL REFERENCES consultations(id),
    classification_reason_id UUID NOT NULL REFERENCES classification_reasons(id),
    PRIMARY KEY (consultation_id, classification_reason_id)
);
