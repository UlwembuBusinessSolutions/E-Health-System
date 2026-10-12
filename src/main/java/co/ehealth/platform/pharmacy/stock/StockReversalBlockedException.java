package co.ehealth.platform.pharmacy.stock;

// StockReversalService — the stock a transaction added has already been
// dispensed, written off or otherwise used, so undoing it would leave the
// lot short. The message tells the pharmacist what to do instead
// (adjust the remainder), which is why it is built by the caller.
public class StockReversalBlockedException extends RuntimeException {
    public StockReversalBlockedException(String message) {
        super(message);
    }
}
