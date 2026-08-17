package co.ehealth.platform.facility;

// Thrown when attempting to archive a record that is already in ARCHIVED
// state. While the operation is technically idempotent (archiving an already-
// archived record doesn't change anything), throwing makes the caller's intent
// explicit — if they wanted to archive it, they probably expected it to be
// ACTIVE. This prevents silent "nothing happened" outcomes.
public class RecordAlreadyArchivedException extends RuntimeException {
    public RecordAlreadyArchivedException() {
        super("This record is already archived.");
    }

    public RecordAlreadyArchivedException(String message) {
        super(message);
    }
}
