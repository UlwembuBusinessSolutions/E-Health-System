package co.ehealth.platform.pharmacy.stock;

// A pharmacy request that is well-formed JSON but breaks a business rule the
// user can fix (missing expiry date, a flag the cold chain demands, ...).
// Mapped to 422; the message is written for the pharmacist, not the developer.
public class PharmacyValidationException extends RuntimeException {
    public PharmacyValidationException(String message) {
        super(message);
    }
}
