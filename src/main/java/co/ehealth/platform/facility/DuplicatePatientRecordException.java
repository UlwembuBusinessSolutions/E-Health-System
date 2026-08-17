package co.ehealth.platform.facility;

// Thrown when attempting to create a patient record with an MRN that
// already exists. Distinct from a general database constraint violation
// to provide the application layer with better error handling.
public class DuplicatePatientRecordException extends RuntimeException {
    private final String field;
    private final String message;

    public DuplicatePatientRecordException(String field, String message) {
        super(message);
        this.field = field;
        this.message = message;
    }

    public String getField() {
        return field;
    }

    @Override
    public String getMessage() {
        return message;
    }
}
