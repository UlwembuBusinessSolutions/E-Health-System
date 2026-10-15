package co.ehealth.platform.pharmacy.stock;

// Plan section 7's movement table. Phase 1 (PharmacyStockLedgerService)
// only ever posts OPENING_BALANCE and RECEIPT — the rest are declared now
// so PharmacyStockEntry/PharmacyStockTransaction never need a schema change
// when Phase 2 (adjustments/holds/write-offs/reversal) and Phase 3
// (dispense) start posting them.
public enum StockTransactionType {
    OPENING_BALANCE, RECEIPT, ADJUSTMENT_POSITIVE, ADJUSTMENT_NEGATIVE, HOLD, RELEASE, WRITE_OFF, REVERSAL,
    DISPENSE, TRANSFER_DISPATCH, TRANSFER_RECEIPT
}
