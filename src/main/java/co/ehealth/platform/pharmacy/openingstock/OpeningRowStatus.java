package co.ehealth.platform.pharmacy.openingstock;

// SERIAL_PRODUCT goes beyond the contract's five statuses: a serial-tracked
// item cannot be loaded from a lot/quantity sheet, because each unit needs
// its own serial number — those go through Receive stock.
public enum OpeningRowStatus {
    OK, UNKNOWN_PRODUCT, BAD_EXPIRY, DUPLICATE_LOT, BAD_QUANTITY, SERIAL_PRODUCT
}
