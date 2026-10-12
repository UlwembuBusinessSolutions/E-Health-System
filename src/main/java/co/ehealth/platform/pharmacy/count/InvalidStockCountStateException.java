package co.ehealth.platform.pharmacy.count;

// Editing, posting or cancelling a count that is no longer a draft.
public class InvalidStockCountStateException extends RuntimeException {
    public InvalidStockCountStateException(String message) {
        super(message);
    }
}
