-- A catalogue of diagnoses so the same condition is recorded the same way every time, which is what
-- makes later analysis (how many bronchitis cases this month, by facility) possible. It starts with
-- common primary-care conditions carrying their ICD-10 code, and grows when a doctor records a
-- diagnosis that is not there yet (source CUSTOM, no code until someone assigns one).
CREATE TABLE diagnoses (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code              VARCHAR(30),
    name              VARCHAR(200) NOT NULL,
    name_key          VARCHAR(200) NOT NULL,
    source            VARCHAR(10)  NOT NULL CHECK (source IN ('ICD10', 'CUSTOM')),
    catalogue_version VARCHAR(30),
    active            BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by        UUID,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_diagnoses_name_key UNIQUE (name_key)
);

CREATE INDEX idx_diagnoses_code ON diagnoses (lower(code));

INSERT INTO diagnoses (code, name, name_key, source, catalogue_version) VALUES
    ('J00',   'Common cold',                         'common cold',                         'ICD10', 'ICD-10 WHO'),
    ('J06.9', 'Upper respiratory tract infection',   'upper respiratory tract infection',   'ICD10', 'ICD-10 WHO'),
    ('J02.9', 'Pharyngitis',                         'pharyngitis',                         'ICD10', 'ICD-10 WHO'),
    ('J03.9', 'Tonsillitis',                         'tonsillitis',                         'ICD10', 'ICD-10 WHO'),
    ('J01.9', 'Sinusitis',                           'sinusitis',                           'ICD10', 'ICD-10 WHO'),
    ('J20.9', 'Acute bronchitis',                    'acute bronchitis',                    'ICD10', 'ICD-10 WHO'),
    ('J18.9', 'Pneumonia',                           'pneumonia',                           'ICD10', 'ICD-10 WHO'),
    ('J45.9', 'Asthma',                              'asthma',                              'ICD10', 'ICD-10 WHO'),
    ('J44.9', 'Chronic obstructive pulmonary disease', 'chronic obstructive pulmonary disease', 'ICD10', 'ICD-10 WHO'),
    ('I10',   'Hypertension',                        'hypertension',                        'ICD10', 'ICD-10 WHO'),
    ('I25.9', 'Ischaemic heart disease',             'ischaemic heart disease',             'ICD10', 'ICD-10 WHO'),
    ('I50.9', 'Heart failure',                       'heart failure',                       'ICD10', 'ICD-10 WHO'),
    ('E11.9', 'Type 2 diabetes mellitus',            'type 2 diabetes mellitus',            'ICD10', 'ICD-10 WHO'),
    ('E10.9', 'Type 1 diabetes mellitus',            'type 1 diabetes mellitus',            'ICD10', 'ICD-10 WHO'),
    ('E78.5', 'Hyperlipidaemia',                     'hyperlipidaemia',                     'ICD10', 'ICD-10 WHO'),
    ('E66.9', 'Obesity',                             'obesity',                             'ICD10', 'ICD-10 WHO'),
    ('E03.9', 'Hypothyroidism',                      'hypothyroidism',                      'ICD10', 'ICD-10 WHO'),
    ('D50.9', 'Iron deficiency anaemia',             'iron deficiency anaemia',             'ICD10', 'ICD-10 WHO'),
    ('A09',   'Gastroenteritis',                     'gastroenteritis',                     'ICD10', 'ICD-10 WHO'),
    ('K29.7', 'Gastritis',                           'gastritis',                           'ICD10', 'ICD-10 WHO'),
    ('K21.9', 'Gastro-oesophageal reflux disease',   'gastro-oesophageal reflux disease',   'ICD10', 'ICD-10 WHO'),
    ('K30',   'Dyspepsia',                           'dyspepsia',                           'ICD10', 'ICD-10 WHO'),
    ('K59.0', 'Constipation',                        'constipation',                        'ICD10', 'ICD-10 WHO'),
    ('N39.0', 'Urinary tract infection',             'urinary tract infection',             'ICD10', 'ICD-10 WHO'),
    ('N76.0', 'Acute vaginitis',                     'acute vaginitis',                     'ICD10', 'ICD-10 WHO'),
    ('N18.9', 'Chronic kidney disease',              'chronic kidney disease',              'ICD10', 'ICD-10 WHO'),
    ('B34.9', 'Viral infection',                     'viral infection',                     'ICD10', 'ICD-10 WHO'),
    ('B54',   'Malaria',                             'malaria',                             'ICD10', 'ICD-10 WHO'),
    ('B24',   'HIV disease',                         'hiv disease',                         'ICD10', 'ICD-10 WHO'),
    ('A16.9', 'Respiratory tuberculosis',            'respiratory tuberculosis',            'ICD10', 'ICD-10 WHO'),
    ('R05',   'Cough',                               'cough',                               'ICD10', 'ICD-10 WHO'),
    ('R50.9', 'Fever',                               'fever',                               'ICD10', 'ICD-10 WHO'),
    ('R51',   'Headache',                            'headache',                            'ICD10', 'ICD-10 WHO'),
    ('R10.4', 'Abdominal pain',                      'abdominal pain',                      'ICD10', 'ICD-10 WHO'),
    ('R11',   'Nausea and vomiting',                 'nausea and vomiting',                 'ICD10', 'ICD-10 WHO'),
    ('R07.4', 'Chest pain',                          'chest pain',                          'ICD10', 'ICD-10 WHO'),
    ('R42',   'Dizziness',                           'dizziness',                           'ICD10', 'ICD-10 WHO'),
    ('M54.5', 'Low back pain',                       'low back pain',                       'ICD10', 'ICD-10 WHO'),
    ('M79.1', 'Myalgia',                             'myalgia',                             'ICD10', 'ICD-10 WHO'),
    ('M25.5', 'Joint pain',                          'joint pain',                          'ICD10', 'ICD-10 WHO'),
    ('M19.9', 'Osteoarthritis',                      'osteoarthritis',                      'ICD10', 'ICD-10 WHO'),
    ('G43.9', 'Migraine',                            'migraine',                            'ICD10', 'ICD-10 WHO'),
    ('G40.9', 'Epilepsy',                            'epilepsy',                            'ICD10', 'ICD-10 WHO'),
    ('F41.9', 'Anxiety disorder',                    'anxiety disorder',                    'ICD10', 'ICD-10 WHO'),
    ('F32.9', 'Depression',                          'depression',                          'ICD10', 'ICD-10 WHO'),
    ('L30.9', 'Dermatitis',                          'dermatitis',                          'ICD10', 'ICD-10 WHO'),
    ('L02.9', 'Skin abscess',                        'skin abscess',                        'ICD10', 'ICD-10 WHO'),
    ('B35.9', 'Fungal skin infection',               'fungal skin infection',               'ICD10', 'ICD-10 WHO'),
    ('B86',   'Scabies',                             'scabies',                             'ICD10', 'ICD-10 WHO'),
    ('H10.9', 'Conjunctivitis',                      'conjunctivitis',                      'ICD10', 'ICD-10 WHO'),
    ('H66.9', 'Otitis media',                        'otitis media',                        'ICD10', 'ICD-10 WHO'),
    ('Z00.0', 'General medical examination',         'general medical examination',         'ICD10', 'ICD-10 WHO'),
    ('Z34.9', 'Normal pregnancy supervision',        'normal pregnancy supervision',        'ICD10', 'ICD-10 WHO');

-- Each diagnosis on a consultation points at its catalogue entry. Rows written before the catalogue
-- existed are linked by name, adding a CUSTOM entry for anything not in the starter set.
ALTER TABLE consultation_diagnoses ADD COLUMN diagnosis_id UUID REFERENCES diagnoses(id);
CREATE INDEX idx_consultation_diagnoses_diagnosis ON consultation_diagnoses (diagnosis_id);

INSERT INTO diagnoses (name, name_key, source)
SELECT DISTINCT ON (key) trim(regexp_replace(diagnosis_text, '\s+', ' ', 'g')), key, 'CUSTOM'
FROM (SELECT diagnosis_text, lower(trim(regexp_replace(diagnosis_text, '\s+', ' ', 'g'))) AS key
      FROM consultation_diagnoses) AS existing
WHERE key <> '' AND length(key) <= 200
ON CONFLICT (name_key) DO NOTHING;

UPDATE consultation_diagnoses cd
SET diagnosis_id = d.id,
    code = COALESCE(cd.code, d.code),
    coding_system = COALESCE(cd.coding_system, CASE d.source WHEN 'ICD10' THEN 'ICD-10' ELSE 'CUSTOM' END),
    catalogue_version = COALESCE(cd.catalogue_version, d.catalogue_version)
FROM diagnoses d
WHERE d.name_key = lower(trim(regexp_replace(cd.diagnosis_text, '\s+', ' ', 'g')));
