package co.ehealth.platform.pharmacy.register;

// The entry or day close request is not acceptable as sent.
public class InvalidRegisterEntryException extends RuntimeException {
    public InvalidRegisterEntryException(String message) {
        super(message);
    }
}
