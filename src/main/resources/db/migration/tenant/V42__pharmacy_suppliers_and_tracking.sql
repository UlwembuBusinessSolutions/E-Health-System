-- Pharmacy module, B2 slice — suppliers, serial units, extended receiving.
-- See Docs/pharmacy-module-contract.md sections 1 and 3. Additive only:
-- nothing here rewrites an applied migration or an existing ledger row.

-- Suppliers. name_key is the normalised form of the name (SupplierNameKey in
-- Java) and is unique so a duplicate can never be created by a race that
-- slips past the service-level check. merged_into_id keeps the audit trail
-- of a merge: the archived source still points at the supplier that
-- absorbed it.
CREATE TABLE pharmacy_suppliers (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(200) NOT NULL,
    name_key         VARCHAR(200) NOT NULL UNIQUE,
    phone            VARCHAR(50),
    email            VARCHAR(200),
    status           VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    merged_into_id   UUID REFERENCES pharmacy_suppliers(id),
    created_by       UUID NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL,
    updated_at       TIMESTAMPTZ,
    CONSTRAINT ck_pharmacy_suppliers_status CHECK (status IN ('ACTIVE', 'ARCHIVED'))
);

-- The products a supplier is ordered from — drives the reorder list.
CREATE TABLE pharmacy_supplier_products (
    supplier_id  UUID NOT NULL REFERENCES pharmacy_suppliers(id),
    product_id   UUID NOT NULL REFERENCES pharmacy_products(id),
    created_at   TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (supplier_id, product_id)
);
CREATE INDEX idx_pharmacy_supplier_products_product ON pharmacy_supplier_products(product_id);

-- Product handling flags. serial_tracked and batch_tracked are mutually
-- exclusive: a serial-tracked unit is its own identity, a lot is a group.
ALTER TABLE pharmacy_products
    ADD COLUMN serial_tracked        BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN schedule              VARCHAR(2),
    ADD COLUMN cold_chain            BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN preferred_supplier_id UUID REFERENCES pharmacy_suppliers(id),
    ADD CONSTRAINT ck_pharmacy_products_schedule CHECK (schedule IS NULL OR schedule IN ('S5', 'S6')),
    ADD CONSTRAINT ck_pharmacy_products_serial_xor_batch CHECK (NOT (serial_tracked AND batch_tracked));

-- Enum-backed columns had no CHECK before; pin them now with the widened
-- value sets (BOX/KIT units, DEVICE category) so the database and the Java
-- enums can never drift apart silently again.
ALTER TABLE pharmacy_products
    ADD CONSTRAINT ck_pharmacy_products_category CHECK (category IN ('MEDICINE', 'SUPPLY', 'DEVICE')),
    ADD CONSTRAINT ck_pharmacy_products_base_unit CHECK (base_unit IN
        ('TABLET', 'CAPSULE', 'BOTTLE', 'VIAL', 'SEALED_PACK', 'EACH', 'BOX', 'KIT'));

-- One row per physical serial-tracked unit. received_entry_id /
-- removed_entry_id point at the immutable ledger entries that created and
-- retired the unit, so a serial's life is always explainable from the ledger.
CREATE TABLE pharmacy_serial_units (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id         UUID NOT NULL REFERENCES pharmacy_products(id),
    batch_id           UUID REFERENCES pharmacy_batches(id),
    serial_number      VARCHAR(100) NOT NULL,
    status             VARCHAR(20) NOT NULL DEFAULT 'IN_STOCK',
    received_entry_id  UUID NOT NULL REFERENCES pharmacy_stock_entries(id),
    removed_entry_id   UUID REFERENCES pharmacy_stock_entries(id),
    CONSTRAINT ck_pharmacy_serial_units_status CHECK (status IN ('IN_STOCK', 'REMOVED')),
    CONSTRAINT uq_pharmacy_serial_units_product_serial UNIQUE (product_id, serial_number)
);
CREATE INDEX idx_pharmacy_serial_units_received_entry ON pharmacy_serial_units(received_entry_id);

-- Receipts: supplier link, supplier invoice, human-readable number and the
-- reversal audit. supplier_name stays as the text recorded at the time.
CREATE SEQUENCE pharmacy_receipt_number_seq;

ALTER TABLE pharmacy_receipts
    ADD COLUMN supplier_id              UUID REFERENCES pharmacy_suppliers(id),
    ADD COLUMN invoice_number           VARCHAR(100),
    ADD COLUMN receipt_number           VARCHAR(20),
    ADD COLUMN reversed_at              TIMESTAMPTZ,
    ADD COLUMN reversed_by_name         VARCHAR(200),
    ADD COLUMN reversal_transaction_id  UUID REFERENCES pharmacy_stock_transactions(id);

WITH numbered AS (
    SELECT id, nextval('pharmacy_receipt_number_seq') AS seq_value
    FROM (SELECT id FROM pharmacy_receipts ORDER BY created_at) ordered
)
UPDATE pharmacy_receipts r
SET receipt_number = 'RCV-' || LPAD(numbered.seq_value::TEXT, 6, '0')
FROM numbered
WHERE r.id = numbered.id;

ALTER TABLE pharmacy_receipts
    ALTER COLUMN receipt_number SET NOT NULL,
    ADD CONSTRAINT uq_pharmacy_receipts_receipt_number UNIQUE (receipt_number),
    ADD CONSTRAINT ck_pharmacy_receipts_status CHECK (status IN ('DRAFT', 'POSTED', 'CANCELLED', 'REVERSED'));

CREATE INDEX idx_pharmacy_receipts_supplier ON pharmacy_receipts(supplier_id);
CREATE INDEX idx_pharmacy_receipts_facility_created ON pharmacy_receipts(facility_id, created_at DESC);

-- Receipt lines: base_quantity is what was actually stocked, so a fully
-- rejected line legitimately stocks 0 — hence >= 0. rejected_quantity keeps
-- what the supplier delivered but the pharmacy refused.
ALTER TABLE pharmacy_receipt_lines DROP CONSTRAINT IF EXISTS pharmacy_receipt_lines_base_quantity_check;
ALTER TABLE pharmacy_receipt_lines
    ADD COLUMN rejected_quantity  INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN flag_reason        VARCHAR(20),
    ADD COLUMN flag_note          VARCHAR(500),
    ADD COLUMN temperature_c      NUMERIC(4, 1),
    ADD COLUMN cold_box_intact    BOOLEAN,
    ADD CONSTRAINT ck_pharmacy_receipt_lines_base_quantity CHECK (base_quantity >= 0),
    ADD CONSTRAINT ck_pharmacy_receipt_lines_rejected_quantity CHECK (rejected_quantity >= 0),
    ADD CONSTRAINT ck_pharmacy_receipt_lines_flag_reason CHECK (flag_reason IS NULL
        OR flag_reason IN ('DAMAGED', 'SHORT', 'WRONG_ITEM', 'NEAR_EXPIRY'));
CREATE INDEX idx_pharmacy_receipt_lines_receipt ON pharmacy_receipt_lines(receipt_id);
