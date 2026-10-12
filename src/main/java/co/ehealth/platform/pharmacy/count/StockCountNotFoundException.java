package co.ehealth.platform.pharmacy.count;

public class StockCountNotFoundException extends RuntimeException {
    public StockCountNotFoundException() {
        super("That stock count was not found.");
    }
}
