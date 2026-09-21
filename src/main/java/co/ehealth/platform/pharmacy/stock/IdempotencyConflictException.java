package co.ehealth.platform.pharmacy.stock;

// PharmacyStockLedgerService — plan section 7: "Require idempotency keys
// on posting commands... Same key/body returns the original result;
// changed body is rejected." This is the "changed body" case — a caller
// reused a key with a different request, which is a client bug or replay
// attempt, not something safe to silently accept.
public class IdempotencyConflictException extends RuntimeException {
    public IdempotencyConflictException() {
        super("This request conflicts with a previous request using the same idempotency key but different details.");
    }
}
