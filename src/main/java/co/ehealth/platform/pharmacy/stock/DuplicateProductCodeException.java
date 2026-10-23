package co.ehealth.platform.pharmacy.stock;

// PharmacyProductService.create() — the normalized code (upper-cased,
// trimmed) already exists. STK-01's own scenario.
public class DuplicateProductCodeException extends RuntimeException {
    public DuplicateProductCodeException(String code) {
        super("A product with code \"" + code + "\" already exists.");
    }
}
