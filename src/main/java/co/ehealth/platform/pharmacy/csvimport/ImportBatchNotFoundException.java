package co.ehealth.platform.pharmacy.csvimport;

public class ImportBatchNotFoundException extends RuntimeException {
    public ImportBatchNotFoundException() {
        super("That import could not be found.");
    }
}
