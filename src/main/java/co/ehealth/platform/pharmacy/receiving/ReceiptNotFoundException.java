package co.ehealth.platform.pharmacy.receiving;

public class ReceiptNotFoundException extends RuntimeException {
    public ReceiptNotFoundException() {
        super("That receipt could not be found.");
    }
}
