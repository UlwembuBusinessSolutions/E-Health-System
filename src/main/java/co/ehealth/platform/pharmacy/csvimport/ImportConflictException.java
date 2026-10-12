package co.ehealth.platform.pharmacy.csvimport;

// The import cannot be undone in its current state: it was already undone, or
// the undo window has passed. Maps to HTTP 409.
public class ImportConflictException extends RuntimeException {
    public ImportConflictException(String message) {
        super(message);
    }
}
