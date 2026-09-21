package co.ehealth.platform.pharmacy.stock;

// PharmacyReceiptService — plan section 6: "Missing expiry on an
// expiry-required medicine prevents release for dispensing." Phase 1
// simply refuses the receipt line outright rather than accepting a
// quarantine-only exception path (no reviewed exception-receipt workflow
// exists yet).
public class MissingExpiryException extends RuntimeException {
    public MissingExpiryException(String productName) {
        super("\"" + productName + "\" requires an expiry date for every batch.");
    }
}
