package co.ehealth.platform.pharmacy.openingstock;

public class OpeningStockAlreadyLoadedException extends RuntimeException {
    public OpeningStockAlreadyLoadedException() {
        super("Opening stock has already been loaded for this facility. Use Receive stock for new deliveries "
                + "or a stock adjustment to correct a quantity.");
    }
}
