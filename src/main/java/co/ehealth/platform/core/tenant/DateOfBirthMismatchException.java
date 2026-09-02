package co.ehealth.platform.core.tenant;

public class DateOfBirthMismatchException extends RuntimeException {
    public DateOfBirthMismatchException() {
        super("The date of birth you entered doesn't match this patient's record.");
    }
}