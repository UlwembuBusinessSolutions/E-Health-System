package co.ehealth.platform.pharmacy.count;

public class StockCountLineNotFoundException extends RuntimeException {
    public StockCountLineNotFoundException() {
        super("That line is not part of this stock count.");
    }
}
