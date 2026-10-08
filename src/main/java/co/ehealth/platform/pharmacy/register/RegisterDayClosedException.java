package co.ehealth.platform.pharmacy.register;

// The day is locked, or being closed a second time.
public class RegisterDayClosedException extends RuntimeException {
    public RegisterDayClosedException(String message) {
        super(message);
    }
}
