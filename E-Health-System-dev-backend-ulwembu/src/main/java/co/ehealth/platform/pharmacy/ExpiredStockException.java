package co.ehealth.platform.pharmacy;

public class ExpiredStockException extends RuntimeException {
    public ExpiredStockException(String barcode) {
        super("Dispensing blocked: stock " + barcode + " has expired. No override is available.");
    }
}
