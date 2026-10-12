-- One row per CSV import, so a whole import can be listed and undone.
-- The items table records exactly what the import created (products and
-- receipts); undoing reverses those receipts and archives those products.
CREATE TABLE pharmacy_import_batches (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id        UUID         NOT NULL REFERENCES facilities(id),
    file_name          VARCHAR(255),
    status             VARCHAR(10)  NOT NULL CHECK (status IN ('ACTIVE', 'UNDONE')),
    rows_imported      INTEGER      NOT NULL,
    products_created   INTEGER      NOT NULL,
    receipts_created   INTEGER      NOT NULL,
    units_received     BIGINT       NOT NULL,
    created_by         UUID         NOT NULL,
    created_by_name    VARCHAR(200) NOT NULL,
    created_at         TIMESTAMPTZ  NOT NULL,
    undone_at          TIMESTAMPTZ,
    undone_by_name     VARCHAR(200)
);

CREATE INDEX idx_pharmacy_import_batches_facility ON pharmacy_import_batches (facility_id, created_at DESC);

CREATE TABLE pharmacy_import_batch_items (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id   UUID        NOT NULL REFERENCES pharmacy_import_batches(id),
    item_type  VARCHAR(10) NOT NULL CHECK (item_type IN ('PRODUCT', 'RECEIPT')),
    ref_id     UUID        NOT NULL
);

CREATE INDEX idx_pharmacy_import_batch_items_batch ON pharmacy_import_batch_items (batch_id);
