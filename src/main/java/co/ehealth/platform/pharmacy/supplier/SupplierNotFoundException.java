package co.ehealth.platform.pharmacy.supplier;

public class SupplierNotFoundException extends RuntimeException {
    public SupplierNotFoundException() {
        super("That supplier could not be found.");
    }
}
