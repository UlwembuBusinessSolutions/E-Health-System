package co.ehealth.platform.pharmacy.supplier;

// A lifecycle or merge request the supplier's current state does not allow
// (merging into itself, reactivating a merged-away supplier, ...). The
// message always says what to do instead.
public class InvalidSupplierStateException extends RuntimeException {
    public InvalidSupplierStateException(String message) {
        super(message);
    }
}
