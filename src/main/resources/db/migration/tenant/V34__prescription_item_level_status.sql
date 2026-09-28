-- Dispensing/out-of-stock moves from the whole prescription to each line
-- item — a pharmacy can now dispense one item while marking another on the
-- same script out of stock, instead of an all-or-nothing action.
--
-- This app has no real production tenants yet (Phase 1 dev brief; every
-- schema here is seed/test data), so this migration replaces the old
-- prescription-level event tables outright rather than carrying a
-- backward-compatible shape forward — the existing rows are backfilled
-- onto items, not preserved as separate legacy tables.

ALTER TABLE prescription_items ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'PENDING';

-- Best-effort backfill: the old model shared one status across every item
-- on a prescription, so every existing item inherits its parent's status
-- exactly — correct for every row that predates this migration, since that
-- was the only status they could have had.
UPDATE prescription_items pi
SET status = p.status
FROM prescriptions p
WHERE p.id = pi.prescription_id AND p.status IN ('DISPENSED', 'OUT_OF_STOCK');

DROP TABLE dispensing_records;
DROP TABLE prescription_out_of_stock_records;

CREATE TABLE dispensing_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_item_id UUID NOT NULL UNIQUE REFERENCES prescription_items(id),
    dispensed_by_user_id UUID NOT NULL,
    dispensed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prescription_out_of_stock_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_item_id UUID NOT NULL UNIQUE REFERENCES prescription_items(id),
    marked_by_user_id UUID NOT NULL,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    note VARCHAR(500)
);

-- Backfill the two event tables themselves from the old prescription-level
-- fact: every item on a prescription that was DISPENSED/OUT_OF_STOCK before
-- this migration gets its own event row, all sharing that prescription's
-- own createdAt as a reasonable stand-in timestamp (the real
-- who/when of the old whole-prescription action wasn't per-item, so this
-- is the closest honest reconstruction — prescriberId doubles as a
-- placeholder actor since the original dispenser/marker isn't recoverable
-- per item).
INSERT INTO dispensing_records (prescription_item_id, dispensed_by_user_id, dispensed_at)
SELECT pi.id, p.prescriber_id, p.created_at
FROM prescription_items pi
JOIN prescriptions p ON p.id = pi.prescription_id
WHERE pi.status = 'DISPENSED';

INSERT INTO prescription_out_of_stock_records (prescription_item_id, marked_by_user_id, marked_at, note)
SELECT pi.id, p.prescriber_id, p.created_at, NULL
FROM prescription_items pi
JOIN prescriptions p ON p.id = pi.prescription_id
WHERE pi.status = 'OUT_OF_STOCK';

-- Prescription.status keeps existing (PENDING/DISPENSED/OUT_OF_STOCK) plus
-- a new PARTIALLY_DISPENSED — the rollup an org's own queue query filters
-- on, recomputed by PrescriptionService after every item action rather
-- than set directly. No CHECK constraint exists on this column to widen
-- (confirmed in V10__pharmacy.sql), so the new enum value needs no schema
-- change here.

-- Pharmacy-to-prescriber messaging (email) about a specific prescription —
-- "something else" queries that aren't a stock or dispensing action.
CREATE TABLE prescriber_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id),
    sender_user_id UUID NOT NULL,
    message VARCHAR(2000) NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prescriber_messages_prescription ON prescriber_messages(prescription_id);
