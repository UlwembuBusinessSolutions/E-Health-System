package co.ehealth.platform.pharmacy.stock;

import java.util.UUID;

// One ledger line with everything the Ledger page shows, already joined.
// runningBalance is only set for a single product's history view (the sum
// of that product's movements up to this line); the facility-wide ledger
// mixes products, so a running total there would be meaningless.
public record LedgerRow(PharmacyStockEntry entry, PharmacyStockAccount account, PharmacyProduct product,
                        PharmacyStockTransaction transaction, PharmacyBatch batch, String patientName,
                        String supplierName, UUID reversedByTransactionId, Long runningBalance) {

    public LedgerRow withRunningBalance(long balance) {
        return new LedgerRow(entry, account, product, transaction, batch, patientName, supplierName,
                reversedByTransactionId, balance);
    }
}
