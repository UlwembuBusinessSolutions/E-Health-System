package co.ehealth.platform.pharmacy.stock;

public class TransactionAlreadyReversedException extends RuntimeException {
    public TransactionAlreadyReversedException() {
        super("This movement has already been reversed. Check the ledger for the linked reversal.");
    }
}
