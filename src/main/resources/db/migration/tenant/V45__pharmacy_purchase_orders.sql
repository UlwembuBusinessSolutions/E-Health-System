-- Purchase orders: what the pharmacy asked a supplier to send. An order is
-- a record only — it moves no stock; stock arrives through a receipt.
-- po_number is handed out by a sequence so two people raising orders at the
-- same moment can never get the same number.
CREATE SEQUENCE pharmacy_purchase_order_number_seq;

CREATE TABLE pharmacy_purchase_orders (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number          VARCHAR(20)  NOT NULL,
    facility_id        UUID         NOT NULL REFERENCES facilities(id),
    supplier_id        UUID         NOT NULL REFERENCES pharmacy_suppliers(id),
    expected_delivery  DATE,
    created_by         UUID         NOT NULL,
    created_by_name    VARCHAR(200) NOT NULL,
    created_at         TIMESTAMPTZ  NOT NULL,
    CONSTRAINT uq_pharmacy_purchase_orders_po_number UNIQUE (po_number)
);

CREATE INDEX idx_pharmacy_purchase_orders_facility ON pharmacy_purchase_orders (facility_id, created_at DESC);
CREATE INDEX idx_pharmacy_purchase_orders_supplier ON pharmacy_purchase_orders (supplier_id, facility_id);

-- quantity is stored (not derived) so the order reads exactly as it was
-- sent, and the CHECK keeps it equal to packs x pack size.
CREATE TABLE pharmacy_purchase_order_lines (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id  UUID    NOT NULL REFERENCES pharmacy_purchase_orders(id),
    product_id         UUID    NOT NULL REFERENCES pharmacy_products(id),
    packs              INTEGER NOT NULL CHECK (packs >= 1),
    pack_size          INTEGER NOT NULL CHECK (pack_size >= 1),
    quantity           INTEGER NOT NULL,
    CONSTRAINT ck_pharmacy_purchase_order_lines_quantity CHECK (quantity = packs * pack_size)
);

CREATE INDEX idx_pharmacy_purchase_order_lines_order ON pharmacy_purchase_order_lines (purchase_order_id);

-- Why a scheduled medicine was destroyed or lost. Nullable: other entry
-- kinds don't need one. Adding a column does not fire the append-only
-- trigger, which only blocks UPDATE and DELETE of existing rows.
ALTER TABLE pharmacy_schedule_register_entries
    ADD COLUMN reason VARCHAR(200);

-- The collector's signature is now stored with the collection itself as a
-- PNG data URL (a few tens of KB), so the old 500-character reference
-- column becomes unlimited text under a name that says what it holds.
ALTER TABLE prescription_collections
    RENAME COLUMN signature_ref TO signature_data_url;
ALTER TABLE prescription_collections
    ALTER COLUMN signature_data_url TYPE TEXT;
