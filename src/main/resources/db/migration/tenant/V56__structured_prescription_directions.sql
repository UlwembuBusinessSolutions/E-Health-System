-- A prescription line now carries its directions as separate fields (dose, route, frequency,
-- duration, quantity unit, instructions) as well as the readable sentence in `dosage`, which
-- the pharmacy screens and the printout keep using. The sentence can be longer now.
ALTER TABLE prescription_items ALTER COLUMN dosage TYPE VARCHAR(300);
ALTER TABLE prescription_purchase_items ALTER COLUMN dosage TYPE VARCHAR(300);

ALTER TABLE prescription_items
    ADD COLUMN strength_form VARCHAR(100),
    ADD COLUMN dose          VARCHAR(100),
    ADD COLUMN route         VARCHAR(30),
    ADD COLUMN frequency     VARCHAR(120),
    ADD COLUMN duration      VARCHAR(100),
    ADD COLUMN quantity_unit VARCHAR(20),
    ADD COLUMN instructions  VARCHAR(500);

ALTER TABLE prescription_purchase_items
    ADD COLUMN strength_form VARCHAR(100),
    ADD COLUMN dose          VARCHAR(100),
    ADD COLUMN route         VARCHAR(30),
    ADD COLUMN frequency     VARCHAR(120),
    ADD COLUMN duration      VARCHAR(100),
    ADD COLUMN quantity_unit VARCHAR(20),
    ADD COLUMN instructions  VARCHAR(500);

-- The doctor's unsigned prescription is kept with the draft consultation, so closing the record
-- and coming back (or another device) finds it exactly as it was.
ALTER TABLE consultations ADD COLUMN prescription_draft TEXT;
