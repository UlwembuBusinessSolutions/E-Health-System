package co.ehealth.platform.pharmacy.receiving;

// Reversing a receipt takes its stock back off the shelf, which is only
// possible while that stock is still there. Once some has been dispensed or
// written off, the honest correction is an adjustment for the missing units,
// and the message says so.
public class ReceiptStockUsedException extends RuntimeException {
    public ReceiptStockUsedException(String receiptNumber, String productName, String lotNumber, long received,
                                     long stillOnShelf) {
        super("Receipt " + receiptNumber + " can't be reversed: only " + stillOnShelf + " of the " + received
                + " units of \"" + productName + "\" (lot " + lotNumber + ") are still in stock - the rest were "
                + "already used or removed. Record an adjustment for the units that are gone instead.");
    }
}
