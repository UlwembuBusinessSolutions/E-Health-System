-- PrescriptionService.markOutOfStock()'s event record — mirrors
-- dispensing_records exactly (one row per prescription, unique), for the
-- other terminal outcome a pending prescription can reach: the pharmacy
-- couldn't fill it, rather than did. The prescription itself is never
-- deleted or its items removed; this only records that it wasn't collected
-- and why.
CREATE TABLE prescription_out_of_stock_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL UNIQUE REFERENCES prescriptions(id),
    marked_by_user_id UUID NOT NULL,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    note VARCHAR(500)
);
