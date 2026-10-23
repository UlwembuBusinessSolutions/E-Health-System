package co.ehealth.platform.pharmacy.stock;

public class StockTransactionNotFoundException extends RuntimeException {
    public StockTransactionNotFoundException() {
        super("Stock movement not found.");
    }
}
