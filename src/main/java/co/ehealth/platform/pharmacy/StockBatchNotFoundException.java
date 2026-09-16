package co.ehealth.platform.pharmacy;

public class StockBatchNotFoundException extends RuntimeException {
    public StockBatchNotFoundException(String barcode) {
        super("No stock batch was found for barcode " + barcode + ".");
    }
}
