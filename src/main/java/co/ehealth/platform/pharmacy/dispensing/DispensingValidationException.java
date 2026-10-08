package co.ehealth.platform.pharmacy.dispensing;

// The request itself is not acceptable as sent (missing collector details,
// verbal consent where written is required, a return larger than what was
// dispensed). GlobalExceptionHandler maps it to 422.
public class DispensingValidationException extends RuntimeException {
    public DispensingValidationException(String message) {
        super(message);
    }
}
