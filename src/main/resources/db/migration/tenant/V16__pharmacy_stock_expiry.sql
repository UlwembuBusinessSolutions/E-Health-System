CREATE TABLE stock_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES facilities(id),
    drug_name VARCHAR(200) NOT NULL,
    batch_number VARCHAR(100) NOT NULL,
    barcode VARCHAR(150) NOT NULL UNIQUE,
    expiry_date DATE NOT NULL,
    quantity_on_hand INT NOT NULL CHECK (quantity_on_hand >= 0),
    CONSTRAINT stock_batches_expiry_not_blank CHECK (length(trim(barcode)) > 0)
);

CREATE INDEX idx_stock_batches_expiry ON stock_batches(facility_id, expiry_date)
    WHERE quantity_on_hand > 0;
