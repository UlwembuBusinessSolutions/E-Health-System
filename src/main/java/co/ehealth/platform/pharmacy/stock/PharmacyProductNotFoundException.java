package co.ehealth.platform.pharmacy.stock;

public class PharmacyProductNotFoundException extends RuntimeException {
    public PharmacyProductNotFoundException() {
        super("Product not found.");
    }
}
