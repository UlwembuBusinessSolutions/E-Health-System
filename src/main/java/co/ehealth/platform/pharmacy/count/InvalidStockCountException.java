package co.ehealth.platform.pharmacy.count;

// The request itself is not acceptable for this count (bad scope, nothing
// to count, a found lot that is already on the list).
public class InvalidStockCountException extends RuntimeException {
    public InvalidStockCountException(String message) {
        super(message);
    }
}
