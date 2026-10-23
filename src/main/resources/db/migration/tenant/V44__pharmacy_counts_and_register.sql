-- Pharmacy stock counts and the scheduled medicines register — see
-- Docs/pharmacy-module-contract.md sections 1 and 3 (B4).

-- Human-readable count references (CNT-000001), allocated only when a count
-- is posted so abandoned drafts never leave gaps in the posted sequence.
CREATE SEQUENCE pharmacy_count_reference_seq START WITH 1;

CREATE TABLE pharmacy_stock_counts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id       UUID NOT NULL,
    location_id       UUID NOT NULL REFERENCES pharmacy_stock_locations(id),
    scope             VARCHAR(10) NOT NULL CHECK (scope IN ('ALL', 'AREA', 'PRODUCT')),
    scope_label       VARCHAR(200),
    blind             BOOLEAN NOT NULL,
    status            VARCHAR(10) NOT NULL CHECK (status IN ('DRAFT', 'POSTED', 'CANCELLED')),
    started_by        UUID NOT NULL,
    started_by_name   VARCHAR(200) NOT NULL,
    started_at        TIMESTAMPTZ NOT NULL,
    posted_by         UUID,
    posted_by_name    VARCHAR(200),
    posted_at         TIMESTAMPTZ,
    reference         VARCHAR(20) UNIQUE
);

CREATE INDEX idx_pharmacy_stock_counts_facility_status ON pharmacy_stock_counts (facility_id, status, started_at DESC);

-- baseline_quantity is the lot's system balance at the moment the line was
-- counted (baseline_taken_at) — never the balance when the count started —
-- so dispensing or receiving during a long count cannot create a false
-- variance. Both stay NULL until the line is counted. A lot found on the
-- shelf that the ledger does not know (found_in_count) has batch_id NULL
-- until posting creates its batch.
CREATE TABLE pharmacy_stock_count_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    count_id            UUID NOT NULL REFERENCES pharmacy_stock_counts(id),
    product_id          UUID NOT NULL REFERENCES pharmacy_products(id),
    batch_id            UUID REFERENCES pharmacy_batches(id),
    found_in_count      BOOLEAN NOT NULL DEFAULT FALSE,
    lot_number          VARCHAR(100) NOT NULL,
    expiry_date         DATE,
    baseline_quantity   BIGINT CHECK (baseline_quantity IS NULL OR baseline_quantity >= 0),
    counted_quantity    BIGINT CHECK (counted_quantity IS NULL OR counted_quantity >= 0),
    reason              VARCHAR(200),
    baseline_taken_at   TIMESTAMPTZ,
    CHECK ((baseline_quantity IS NULL) = (counted_quantity IS NULL))
);

CREATE INDEX idx_pharmacy_stock_count_lines_count ON pharmacy_stock_count_lines (count_id);

-- Append-only register of Schedule 5/6 medicines. seq gives a total order
-- per insertion (entry_at can tie); the balance check backs up the
-- service's own "never below zero" rule.
CREATE TABLE pharmacy_schedule_register_entries (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seq                    BIGINT GENERATED ALWAYS AS IDENTITY,
    facility_id            UUID NOT NULL,
    product_id             UUID NOT NULL REFERENCES pharmacy_products(id),
    entry_at               TIMESTAMPTZ NOT NULL,
    kind                   VARCHAR(10) NOT NULL
                               CHECK (kind IN ('DISPENSED', 'RECEIVED', 'DESTROYED', 'LOST', 'RETURNED', 'OPENING')),
    rx_serial              VARCHAR(50),
    patient_name           VARCHAR(200),
    patient_id_ref         VARCHAR(100),
    prescriber_name        VARCHAR(200),
    prescriber_reg_no      VARCHAR(50),
    quantity_in            BIGINT NOT NULL CHECK (quantity_in >= 0),
    quantity_out           BIGINT NOT NULL CHECK (quantity_out >= 0),
    balance_after          BIGINT NOT NULL CHECK (balance_after >= 0),
    lot_number             VARCHAR(100) NOT NULL,
    dispensed_by           UUID NOT NULL,
    dispensed_by_name      VARCHAR(200) NOT NULL,
    witnessed_by           UUID,
    witnessed_by_name      VARCHAR(200),
    ledger_transaction_id  UUID REFERENCES pharmacy_stock_transactions(id),
    CHECK ((quantity_in > 0) <> (quantity_out > 0))
);

CREATE INDEX idx_pharmacy_schedule_register_product
    ON pharmacy_schedule_register_entries (facility_id, product_id, seq DESC);

-- A register that can be edited is not a register: the service exposes no
-- update/delete, and this trigger makes the database refuse them too.
CREATE FUNCTION pharmacy_schedule_register_reject_change() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'pharmacy_schedule_register_entries is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pharmacy_schedule_register_append_only
    BEFORE UPDATE OR DELETE ON pharmacy_schedule_register_entries
    FOR EACH ROW EXECUTE FUNCTION pharmacy_schedule_register_reject_change();

CREATE TABLE pharmacy_schedule_day_closes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id      UUID NOT NULL,
    product_id       UUID NOT NULL REFERENCES pharmacy_products(id),
    business_date    DATE NOT NULL,
    opening          BIGINT NOT NULL,
    received         BIGINT NOT NULL,
    dispensed        BIGINT NOT NULL,
    destroyed        BIGINT NOT NULL,
    lost             BIGINT NOT NULL,
    returned         BIGINT NOT NULL,
    expected         BIGINT NOT NULL,
    counted          BIGINT NOT NULL CHECK (counted >= 0),
    variance         BIGINT NOT NULL,
    variance_reason  VARCHAR(500),
    closed_by        UUID NOT NULL,
    closed_by_name   VARCHAR(200) NOT NULL,
    closed_at        TIMESTAMPTZ NOT NULL,
    UNIQUE (facility_id, product_id, business_date)
);
