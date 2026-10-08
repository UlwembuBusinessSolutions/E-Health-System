-- Pharmacy stock ledger, Phase 1 (catalog + batches + receiving) — see
-- Docs/pharmacy-stock-ledger-plan.md sections 4-8 and 14. Product creation
-- and stock receiving are deliberately separate actor fields throughout
-- (rule 1 of the plan's "Non-negotiable stock rules"); posted ledger rows
-- are never updated or deleted by application code (rule 2) — corrections
-- are a Phase 2 reversal/adjustment movement, not a UPDATE/DELETE here.

-- The organization-wide catalog. code is unique per tenant after
-- normalization (upper-cased, trimmed) — enforced by a generated column
-- rather than trusting every write path to normalize before insert.
CREATE TABLE pharmacy_products (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                  VARCHAR(50) NOT NULL,
    code_normalized       VARCHAR(50) GENERATED ALWAYS AS (UPPER(TRIM(code))) STORED,
    display_name          VARCHAR(200) NOT NULL,
    generic_name          VARCHAR(200),
    strength              VARCHAR(100),
    dosage_form           VARCHAR(100),
    category              VARCHAR(20) NOT NULL, -- MEDICINE | SUPPLY
    base_unit             VARCHAR(20) NOT NULL, -- TABLET | CAPSULE | BOTTLE | VIAL | SEALED_PACK | EACH
    pack_size             INTEGER CHECK (pack_size IS NULL OR pack_size > 0),
    barcode               VARCHAR(64),
    manufacturer          VARCHAR(200),
    batch_tracked         BOOLEAN NOT NULL DEFAULT TRUE,
    expiry_tracked        BOOLEAN NOT NULL DEFAULT TRUE,
    storage_instructions  VARCHAR(500),
    active                BOOLEAN NOT NULL DEFAULT TRUE,
    created_by            UUID NOT NULL,
    created_by_name       VARCHAR(200) NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL,
    updated_by            UUID,
    updated_by_name       VARCHAR(200),
    updated_at            TIMESTAMPTZ,
    version               INTEGER NOT NULL DEFAULT 0,
    UNIQUE (code_normalized)
);

-- Which facilities stock a product, and at what reorder/target level — a
-- product not in a facility's assortment must never surface as "out of
-- stock" there (plan section 4's own rule).
CREATE TABLE pharmacy_facility_products (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id          UUID NOT NULL REFERENCES pharmacy_products(id),
    facility_id         UUID NOT NULL,
    reorder_threshold   INTEGER CHECK (reorder_threshold IS NULL OR reorder_threshold >= 0),
    target_quantity     INTEGER CHECK (target_quantity IS NULL OR target_quantity >= 0),
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL,
    UNIQUE (product_id, facility_id)
);

-- Bin/location within a facility — Phase 1 auto-creates exactly one
-- ("Main") per facility on first use (PharmacyStockLocationService), never
-- exposed as something staff manage directly yet; the column exists now so
-- Phase 5+ multi-location tracking is an additive change, not a rename.
CREATE TABLE pharmacy_stock_locations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL,
    code        VARCHAR(20) NOT NULL,
    name        VARCHAR(100) NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL,
    UNIQUE (facility_id, code)
);

-- A tracked lot. Every product gets at least one batch row, even an
-- untracked one (lot_number = 'N/A', expiry_date NULL) — stock accounts
-- below always reference a non-null batch id rather than special-casing a
-- nullable one, per the plan's own "Handle untracked products explicitly"
-- rule (section 14).
CREATE TABLE pharmacy_batches (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id        UUID NOT NULL REFERENCES pharmacy_products(id),
    manufacturer      VARCHAR(200),
    lot_number        VARCHAR(100) NOT NULL,
    expiry_date       DATE,
    expiry_precision  VARCHAR(10), -- DAY | MONTH, null when expiry_date is null
    printed_expiry    VARCHAR(50), -- as printed on the pack, alongside the normalized date (section 6)
    created_by        UUID NOT NULL,
    created_by_name   VARCHAR(200) NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL,
    UNIQUE (product_id, manufacturer, lot_number)
);

-- One balance per product + batch + location + bucket. bucket is AVAILABLE
-- for everything Phase 1 posts; HELD exists in the enum now so Phase 2's
-- hold/release movements are an additive bucket value, not a schema
-- change. quantity is the only mutable column here, and only ever written
-- by PharmacyStockLedgerService inside a locked, atomic posting — never
-- directly by a controller (plan section 7's posting sequence).
CREATE TABLE pharmacy_stock_accounts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID NOT NULL REFERENCES pharmacy_products(id),
    batch_id    UUID NOT NULL REFERENCES pharmacy_batches(id),
    location_id UUID NOT NULL REFERENCES pharmacy_stock_locations(id),
    bucket      VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    quantity    BIGINT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    UNIQUE (product_id, batch_id, location_id, bucket)
);

-- One posting event — receipt, opening balance, and (Phase 2+) adjustment/
-- hold/release/write-off/reversal/dispense/transfer all create exactly one
-- row here, never edited afterward (rule 2). idempotency_key is always
-- populated (server-derived from actor+operation+body hash when the
-- caller doesn't supply one — PharmacyStockLedgerService's own why-note) so
-- a retried request with the same key+body returns the original result
-- instead of posting twice (plan section 7, STK-10).
CREATE TABLE pharmacy_stock_transactions (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type                   VARCHAR(30) NOT NULL,
    facility_id            UUID NOT NULL,
    actor_user_id          UUID NOT NULL,
    actor_name             VARCHAR(200) NOT NULL,
    reason                 VARCHAR(500),
    source_reference       VARCHAR(200),
    idempotency_key        VARCHAR(128) NOT NULL,
    body_hash              VARCHAR(128) NOT NULL,
    reversal_of_transaction_id UUID REFERENCES pharmacy_stock_transactions(id),
    created_at             TIMESTAMPTZ NOT NULL,
    UNIQUE (idempotency_key)
);

-- One immutable signed line per affected stock account per transaction.
-- seq is the server-assigned global ordering (plan section 7: "Running
-- balances use server sequence order") — never derived from created_at
-- alone, which isn't guaranteed monotonic under concurrent commits.
CREATE TABLE pharmacy_stock_entries (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seq               BIGSERIAL NOT NULL,
    transaction_id    UUID NOT NULL REFERENCES pharmacy_stock_transactions(id),
    stock_account_id  UUID NOT NULL REFERENCES pharmacy_stock_accounts(id),
    quantity_delta    BIGINT NOT NULL,
    balance_before    BIGINT NOT NULL,
    balance_after     BIGINT NOT NULL CHECK (balance_after >= 0),
    created_at        TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_pharmacy_stock_entries_account_seq ON pharmacy_stock_entries(stock_account_id, seq);

-- The receiving record itself — status is always POSTED in Phase 1
-- (DRAFT/CANCELLED exist in the enum for the later persisted-draft
-- lifecycle the plan describes; Phase 1's "review before posting" is a
-- client-side confirmation step, not a resumable server-side draft —
-- documented simplification, see pharmacy-stock-ledger-context.md's own
-- delivery-order note). transaction_id is always set once posted.
CREATE TABLE pharmacy_receipts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id      UUID NOT NULL,
    location_id      UUID NOT NULL REFERENCES pharmacy_stock_locations(id),
    status           VARCHAR(20) NOT NULL DEFAULT 'POSTED',
    source_reference VARCHAR(200),
    supplier_name    VARCHAR(200),
    created_by       UUID NOT NULL,
    created_by_name  VARCHAR(200) NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL,
    transaction_id   UUID REFERENCES pharmacy_stock_transactions(id)
);

CREATE TABLE pharmacy_receipt_lines (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id        UUID NOT NULL REFERENCES pharmacy_receipts(id),
    product_id        UUID NOT NULL REFERENCES pharmacy_products(id),
    manufacturer      VARCHAR(200),
    lot_number        VARCHAR(100) NOT NULL,
    expiry_date       DATE,
    expiry_precision  VARCHAR(10),
    packs             INTEGER CHECK (packs IS NULL OR packs > 0),
    pack_size_used    INTEGER CHECK (pack_size_used IS NULL OR pack_size_used > 0),
    base_quantity     INTEGER NOT NULL CHECK (base_quantity > 0),
    batch_id          UUID REFERENCES pharmacy_batches(id)
);
