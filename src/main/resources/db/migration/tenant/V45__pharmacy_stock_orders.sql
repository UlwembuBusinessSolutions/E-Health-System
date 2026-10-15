CREATE TABLE pharmacy_stock_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES facilities(id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT', 'AUTHORISED', 'SUBMITTED')),
    created_by UUID NOT NULL REFERENCES users(id),
    created_by_name VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    authorised_by UUID REFERENCES users(id),
    authorised_by_name VARCHAR(200),
    authorised_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 0,
    CHECK ((status = 'DRAFT' AND authorised_by IS NULL AND authorised_at IS NULL AND submitted_at IS NULL)
        OR (status = 'AUTHORISED' AND authorised_by IS NOT NULL AND authorised_at IS NOT NULL AND submitted_at IS NULL)
        OR (status = 'SUBMITTED' AND authorised_by IS NOT NULL AND authorised_at IS NOT NULL AND submitted_at IS NOT NULL))
);
CREATE INDEX idx_pharmacy_stock_orders_facility_created
    ON pharmacy_stock_orders(facility_id, created_at DESC);

CREATE TABLE pharmacy_stock_order_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES pharmacy_stock_orders(id),
    product_id UUID NOT NULL REFERENCES pharmacy_products(id),
    product_code VARCHAR(50) NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    base_unit VARCHAR(20) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0)
);
CREATE INDEX idx_pharmacy_stock_order_lines_order ON pharmacy_stock_order_lines(order_id, id);