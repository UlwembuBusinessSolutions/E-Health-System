package co.ehealth.platform.pharmacy.receiving;

public class ReceiptAlreadyReversedException extends RuntimeException {
    public ReceiptAlreadyReversedException(String receiptNumber) {
        super("Receipt " + receiptNumber + " has already been reversed. Nothing more to undo.");
    }
}
