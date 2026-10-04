-- Stock-backed dispensing (pharmacy module contract, section 3 "B3").
--
-- Prescription items become optionally inventory-backed: product_id is NULL
-- for legacy free-text items, which stay readable and are explicitly "not
-- inventory-backed" (nothing here ever guesses a product for them).

ALTER TABLE prescription_items ADD COLUMN product_id UUID REFERENCES pharmacy_products(id);
ALTER TABLE prescription_items
    ADD COLUMN dispensed_quantity INTEGER NOT NULL DEFAULT 0 CHECK (dispensed_quantity >= 0),
    ADD CONSTRAINT chk_prescription_items_dispensed_within_quantity CHECK (dispensed_quantity <= quantity);

-- Items dispensed before stock-backed dispensing existed were handed over
-- in full; recording that keeps "remaining = quantity - dispensed" at zero
-- for them instead of making them look unfinished.
UPDATE prescription_items SET dispensed_quantity = quantity WHERE status = 'DISPENSED';

CREATE INDEX idx_prescription_items_product ON prescription_items(product_id);

-- A pharmacist's confirmed drug-name -> product choice, remembered so the
-- same prescribed name pre-selects next time. drug_name_key is the
-- normalised (lower-case, punctuation-free) name — exact match only.
CREATE TABLE pharmacy_drug_mappings (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drug_name_key VARCHAR(200) NOT NULL UNIQUE,
    product_id    UUID NOT NULL REFERENCES pharmacy_products(id),
    confirmed_by  UUID NOT NULL,
    confirmed_at  TIMESTAMPTZ NOT NULL
);

-- Which lot(s) a dispense drew from. One item can span several lots, so
-- this is one row per (dispense event, lot), each pointing at the ledger
-- transaction that deducted the stock.
CREATE TABLE pharmacy_dispense_allocations (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_item_id UUID NOT NULL REFERENCES prescription_items(id),
    batch_id             UUID NOT NULL REFERENCES pharmacy_batches(id),
    quantity             INTEGER NOT NULL CHECK (quantity > 0),
    stock_transaction_id UUID NOT NULL REFERENCES pharmacy_stock_transactions(id),
    dispensed_by         UUID NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_pharmacy_dispense_allocations_item ON pharmacy_dispense_allocations(prescription_item_id);
CREATE INDEX idx_pharmacy_dispense_allocations_batch ON pharmacy_dispense_allocations(batch_id);

-- One row per hand-over event. signature_ref / proof_document_ref are
-- opaque references to wherever the captured image or scan is stored; this
-- schema never holds the file itself.
CREATE TABLE prescription_collections (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id       UUID NOT NULL REFERENCES prescriptions(id),
    collected_by_patient  BOOLEAN NOT NULL,
    collector_name        VARCHAR(200),
    collector_id_type     VARCHAR(30),
    collector_id_number   VARCHAR(50),
    relationship          VARCHAR(100),
    phone                 VARCHAR(30),
    authorisation_type    VARCHAR(10) CHECK (authorisation_type IS NULL OR authorisation_type IN ('WRITTEN', 'VERBAL')),
    proof_document_ref    VARCHAR(500),
    signature_ref         VARCHAR(500),
    id_verified           BOOLEAN NOT NULL,
    notes                 VARCHAR(500),
    handed_over_by        UUID NOT NULL,
    handed_over_at        TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_prescription_collections_prescription ON prescription_collections(prescription_id);

-- A return is recorded per lot so the same lot can never be returned
-- beyond what was dispensed from it. restocked = the unit went back on the
-- shelf (UNOPENED / WRONG_ITEM); a DAMAGED return is written off instead.
CREATE TABLE prescription_returns (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_item_id UUID NOT NULL REFERENCES prescription_items(id),
    batch_id             UUID NOT NULL REFERENCES pharmacy_batches(id),
    quantity             INTEGER NOT NULL CHECK (quantity > 0),
    condition            VARCHAR(20) NOT NULL CHECK (condition IN ('UNOPENED', 'DAMAGED', 'WRONG_ITEM')),
    reason               VARCHAR(500) NOT NULL,
    restocked            BOOLEAN NOT NULL,
    stock_transaction_id UUID REFERENCES pharmacy_stock_transactions(id),
    recorded_by          UUID NOT NULL,
    recorded_at          TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_prescription_returns_item ON prescription_returns(prescription_item_id);

CREATE TABLE prescription_substitutions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_item_id  UUID NOT NULL REFERENCES prescription_items(id),
    substitute_product_id UUID NOT NULL REFERENCES pharmacy_products(id),
    status                VARCHAR(10) NOT NULL CHECK (status IN ('REQUESTED', 'APPROVED', 'REJECTED')),
    requested_by          UUID NOT NULL,
    requested_at          TIMESTAMPTZ NOT NULL,
    decided_by            UUID,
    decided_at            TIMESTAMPTZ,
    note                  VARCHAR(500)
);
CREATE INDEX idx_prescription_substitutions_item ON prescription_substitutions(prescription_item_id);

-- Patient-linked ledger history: the dispense transaction itself carries
-- who it was for and which prescription (the human-facing serial lives in
-- the existing source_reference column). Nullable — every non-dispensing
-- movement leaves both empty.
ALTER TABLE pharmacy_stock_transactions
    ADD COLUMN patient_id UUID,
    ADD COLUMN prescription_id UUID;
CREATE INDEX idx_pharmacy_stock_transactions_patient ON pharmacy_stock_transactions(patient_id)
    WHERE patient_id IS NOT NULL;
