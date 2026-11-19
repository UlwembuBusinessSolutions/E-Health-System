ALTER TABLE consultations
    ADD COLUMN art_pathway_code VARCHAR(40)
        CHECK (art_pathway_code IS NULL OR art_pathway_code IN (
            'ADULT_ART_INITIATION',
            'ADULT_ART_FOLLOW_UP_VISIT'
        )),
    ADD CONSTRAINT chk_consultation_art_pathway_reason
            CHECK (
                art_pathway_code IS NULL
                OR (service_reason_code IS NOT NULL AND service_reason_code = 'ART')
            );
