package co.ehealth.platform.pharmacy.dispensing;

// The request is well-formed but clashes with the current stock or
// prescription state (an expired lot, not enough stock, a substitution
// already awaiting an answer). GlobalExceptionHandler maps it to 409; the
// message is written for a pharmacist to act on.
public class DispensingConflictException extends RuntimeException {
    public DispensingConflictException(String message) {
        super(message);
    }
}
