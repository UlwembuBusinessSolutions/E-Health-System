package co.ehealth.platform.identity;

public class StaffDocumentNotFoundException extends RuntimeException {
    public StaffDocumentNotFoundException() {
        super("Document not found.");
    }
}
