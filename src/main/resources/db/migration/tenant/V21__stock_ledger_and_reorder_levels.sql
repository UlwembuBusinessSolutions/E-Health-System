CREATE TABLE stock_reorder_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES facilities(id),
    drug_name VARCHAR(200) NOT NULL,
    reorder_level INT NOT NULL CHECK (reorder_level >= 0),
    CONSTRAINT stock_reorder_levels_facility_drug_unique UNIQUE (facility_id, drug_name)
);

CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES facilities(id),
    drug_name VARCHAR(200) NOT NULL,
    batch_id UUID REFERENCES stock_batches(id),
    movement_type VARCHAR(20) NOT NULL,
    quantity_delta INT NOT NULL,
    quantity_before INT NOT NULL CHECK (quantity_before >= 0),
    quantity_after INT NOT NULL CHECK (quantity_after >= 0),
    reference_id VARCHAR(100),
    performed_by_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_movements_facility_drug_created
    ON stock_movements(facility_id, drug_name, created_at DESC);
