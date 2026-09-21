package co.ehealth.platform.pharmacy.stock;

// PharmacyStockLedgerService — plan section 6: "Conflicting expiry for the
// same product/manufacturer/lot requires review; do not silently merge or
// create a separate lot solely to hide the conflict." STK-06's own
// scenario. Phase 1 surfaces this as a hard rejection requiring a person
// to resolve it (correct the lot number, or confirm the existing expiry)
// — no automated review/quarantine workflow yet.
public class BatchExpiryConflictException extends RuntimeException {
    public BatchExpiryConflictException(String lotNumber) {
        super("Lot \"" + lotNumber + "\" is already recorded with a different expiry date. "
                + "Check the batch/expiry or use a different lot number.");
    }
}
