package co.ehealth.platform.patient;

// SouthAfricanIdNumber.parse() throws this for anything that isn't 13
// digits with a valid Luhn check digit and a real calendar date in its
// first six digits — a client input problem, not a server error, same
// "narrow exception type" reasoning as every other purpose-built exception
// in this codebase (DuplicateFieldException, AccountLockedException, ...).
public class InvalidIdNumberException extends RuntimeException {
    public InvalidIdNumberException() {
        super("Not a valid South African ID number.");
    }
}
