package co.ehealth.platform.pharmacy.stock;

// Why a posted movement is being undone. OTHER requires a written note, the
// same rule adjustments follow.
public enum ReversalReason {
    WRONG_ENTRY, DUPLICATE_ENTRY, RETURNED_TO_SUPPLIER, OTHER
}
