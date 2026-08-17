package co.ehealth.platform.facility;

// Thrown when a requested patient record is not found by ID or other lookup.
// Distinct from a general "not found" exception to allow specific handling
// in the controller layer.
public class RecordNotFoundException extends RuntimeException {
    public RecordNotFoundException() {
        super("Patient record not found.");
    }

    public RecordNotFoundException(String message) {
        super(message);
    }
}
