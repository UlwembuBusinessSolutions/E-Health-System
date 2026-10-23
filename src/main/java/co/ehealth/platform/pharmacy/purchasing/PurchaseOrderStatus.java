package co.ehealth.platform.pharmacy.purchasing;

/** Only SUBMITTED means the procurement gateway acknowledged the order. */
public enum PurchaseOrderStatus {
    DRAFT, AUTHORIZED, TRANSMISSION_FAILED, SUBMITTED, REJECTED
}
