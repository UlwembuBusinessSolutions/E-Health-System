-- EP-10 / PHRM-F03: governance for procurement and durable stock alerts.
-- Existing historic purchase orders are deliberately treated as drafts, never as already approved.
ALTER TABLE pharmacy_purchase_orders
    ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN authorized_by UUID REFERENCES users(id),
    ADD COLUMN authorized_by_name VARCHAR(200),
    ADD COLUMN authorized_at TIMESTAMPTZ,
    ADD COLUMN submitted_at TIMESTAMPTZ,
    ADD COLUMN catalogue_reference VARCHAR(200),
    ADD COLUMN transmission_error VARCHAR(500),
    ADD CONSTRAINT ck_pharmacy_purchase_order_state CHECK (status IN
      ('DRAFT', 'AUTHORIZED', 'TRANSMISSION_FAILED', 'SUBMITTED', 'REJECTED')),
    ADD CONSTRAINT ck_po_authorized CHECK (status NOT IN ('AUTHORIZED', 'TRANSMISSION_FAILED', 'SUBMITTED')
      OR (authorized_by IS NOT NULL AND authorized_at IS NOT NULL)),
    ADD CONSTRAINT ck_po_submitted CHECK (status <> 'SUBMITTED' OR submitted_at IS NOT NULL);
CREATE INDEX idx_pharmacy_purchase_orders_status ON pharmacy_purchase_orders(facility_id, status);

CREATE TABLE pharmacy_reorder_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES facilities(id),
    product_id UUID NOT NULL REFERENCES pharmacy_products(id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('LOW', 'OUT', 'RESOLVED')),
    quantity BIGINT NOT NULL,
    reorder_threshold INTEGER NOT NULL,
    first_raised_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    UNIQUE(facility_id, product_id)
);
CREATE INDEX idx_pharmacy_reorder_alerts_open ON pharmacy_reorder_alerts(facility_id, status);

-- Stock ledger and stock entries are already immutable and transactional (V35).
-- Outbound procurement is intentionally not marked SUBMITTED without an acknowledgement.

-- Backfill current shortage conditions, including configured products without any receipts.
INSERT INTO pharmacy_reorder_alerts(facility_id, product_id, status, quantity, reorder_threshold)
SELECT fp.facility_id, fp.product_id,
       CASE WHEN COALESCE(SUM(a.quantity),0) = 0 THEN 'OUT' ELSE 'LOW' END,
       COALESCE(SUM(a.quantity),0), fp.reorder_threshold
FROM pharmacy_facility_products fp
JOIN pharmacy_products p ON p.id = fp.product_id AND p.active
LEFT JOIN pharmacy_stock_locations l ON l.facility_id = fp.facility_id
LEFT JOIN pharmacy_stock_accounts a ON a.location_id = l.id AND a.product_id = fp.product_id
    AND a.bucket = 'AVAILABLE'
WHERE fp.active AND fp.reorder_threshold IS NOT NULL
GROUP BY fp.facility_id, fp.product_id, fp.reorder_threshold
HAVING COALESCE(SUM(a.quantity),0) <= fp.reorder_threshold
ON CONFLICT(facility_id, product_id) DO NOTHING;
