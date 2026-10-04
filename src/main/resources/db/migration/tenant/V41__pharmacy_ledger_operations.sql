-- Pharmacy ledger operations (adjustments, reversal, filterable ledger,
-- worklists) — see Docs/pharmacy-module-contract.md section 3, "B1".
--
-- pharmacy_stock_transactions.type and pharmacy_stock_entries carry no
-- inline CHECK constraint (V35 declares type as a plain VARCHAR(30)), so the
-- WRITE_OFF / ADJUSTMENT_* / REVERSAL values this module starts posting need
-- no constraint widening — the enum already lived in StockTransactionType.

-- Context a ledger row can carry so the Ledger page can filter and display
-- it without joining back through receipts/prescriptions. All nullable:
-- supplier_id is populated by receiving (suppliers arrive in V42, so no FK
-- here), patient_id and prescription_serial by dispensing, reason_code by
-- adjustments and reversals. reversal_of_transaction_id already exists
-- from V35.
ALTER TABLE pharmacy_stock_transactions
    ADD COLUMN supplier_id          UUID,
    ADD COLUMN patient_id           UUID,
    ADD COLUMN prescription_serial  VARCHAR(30),
    ADD COLUMN reason_code          VARCHAR(30);

-- Ledger listing: the per-transaction join and the newest-first ordering.
CREATE INDEX idx_pharmacy_stock_entries_transaction ON pharmacy_stock_entries(transaction_id);
CREATE INDEX idx_pharmacy_stock_entries_seq ON pharmacy_stock_entries(seq DESC);

-- The ledger filters: type, date range, supplier and patient.
CREATE INDEX idx_pharmacy_stock_transactions_facility_type ON pharmacy_stock_transactions(facility_id, type);
CREATE INDEX idx_pharmacy_stock_transactions_facility_created ON pharmacy_stock_transactions(facility_id, created_at DESC);
CREATE INDEX idx_pharmacy_stock_transactions_supplier ON pharmacy_stock_transactions(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX idx_pharmacy_stock_transactions_patient ON pharmacy_stock_transactions(patient_id) WHERE patient_id IS NOT NULL;

-- "Has this transaction already been reversed?" and "which reversal points
-- at it?" are both looked up by the reversed transaction's id.
CREATE INDEX idx_pharmacy_stock_transactions_reversal_of ON pharmacy_stock_transactions(reversal_of_transaction_id)
    WHERE reversal_of_transaction_id IS NOT NULL;

-- Stock worklists scan a facility's accounts by product and by batch, and
-- the expiry worklist range-scans batches by expiry date.
CREATE INDEX idx_pharmacy_stock_accounts_product ON pharmacy_stock_accounts(product_id);
CREATE INDEX idx_pharmacy_stock_accounts_batch ON pharmacy_stock_accounts(batch_id);
CREATE INDEX idx_pharmacy_batches_expiry ON pharmacy_batches(expiry_date) WHERE expiry_date IS NOT NULL;
