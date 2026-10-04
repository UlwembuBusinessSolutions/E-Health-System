package co.ehealth.platform.pharmacy.dispensing;

// CONFIRMED: a pharmacist chose the product for this item. SUGGESTED: the
// drug name matches a mapping remembered from earlier, awaiting confirmation.
public enum MappingStatus {
    CONFIRMED, SUGGESTED, UNMAPPED
}
