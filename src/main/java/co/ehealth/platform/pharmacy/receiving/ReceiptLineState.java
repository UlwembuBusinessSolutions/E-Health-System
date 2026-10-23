package co.ehealth.platform.pharmacy.receiving;

// Where a received line's stock stands now.
public enum ReceiptLineState {
    ON_SHELF, PARTLY_USED, REVERSED;

    public static ReceiptLineState of(boolean receiptReversed, int usedQuantity) {
        if (receiptReversed) {
            return REVERSED;
        }
        return usedQuantity > 0 ? PARTLY_USED : ON_SHELF;
    }
}
