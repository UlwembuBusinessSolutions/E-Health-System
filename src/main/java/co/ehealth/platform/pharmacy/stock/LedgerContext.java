package co.ehealth.platform.pharmacy.stock;

import java.util.UUID;

// The optional business context a posting carries beyond its quantities —
// who the stock came from or went to, and why. Kept as one value object so
// PharmacyStockLedgerService.postEntries() doesn't grow a parameter every
// time the Ledger page learns a new column; every field is nullable
// because most movement types only use one or two of them.
public record LedgerContext(UUID reversalOfTransactionId, UUID supplierId, UUID patientId,
                            String prescriptionSerial, String reasonCode) {

    public static final LedgerContext NONE = new LedgerContext(null, null, null, null, null);

    public static LedgerContext forReason(String reasonCode) {
        return new LedgerContext(null, null, null, null, reasonCode);
    }

    // A reversal keeps the original's supplier/patient/prescription so the
    // Ledger still shows who the corrected movement belonged to.
    public LedgerContext reversing(UUID originalTransactionId, String reversalReasonCode) {
        return new LedgerContext(originalTransactionId, supplierId, patientId, prescriptionSerial,
                reversalReasonCode);
    }

    public static LedgerContext of(PharmacyStockTransaction transaction) {
        return new LedgerContext(transaction.getReversalOfTransactionId(), transaction.getSupplierId(),
                transaction.getPatientId(), transaction.getPrescriptionSerial(), transaction.getReasonCode());
    }
}
