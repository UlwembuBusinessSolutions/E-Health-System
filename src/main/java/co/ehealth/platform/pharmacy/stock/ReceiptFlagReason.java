package co.ehealth.platform.pharmacy.stock;

// Why a delivered line was queried at the door. A flagged line may still be
// partly accepted; whatever is not accepted is never stocked.
public enum ReceiptFlagReason {
    DAMAGED, SHORT, WRONG_ITEM, NEAR_EXPIRY
}
