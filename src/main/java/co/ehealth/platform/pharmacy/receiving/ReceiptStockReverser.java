package co.ehealth.platform.pharmacy.receiving;

import co.ehealth.platform.pharmacy.stock.PharmacyReceipt;
import co.ehealth.platform.pharmacy.stock.PharmacyStockTransaction;

import java.util.UUID;

// Takes a receipt's stock back off the shelf. Kept behind an interface so the
// receipt screens do not care whether the REVERSAL is posted here
// (LedgerReceiptStockReverser) or by the shared ledger reversal service.
//
// Contract for every implementation:
//  - runs inside the caller's transaction and posts exactly one REVERSAL
//    transaction, linked to the receipt's own transaction, with a negative
//    entry for everything the receipt stocked;
//  - is all-or-nothing: if any lot holds less than the receipt put in, it
//    throws ReceiptStockUsedException and posts nothing;
//  - returns the REVERSAL transaction it posted.
public interface ReceiptStockReverser {

    PharmacyStockTransaction reverse(PharmacyReceipt receipt, String reason, UUID actorUserId, String actorName);
}
