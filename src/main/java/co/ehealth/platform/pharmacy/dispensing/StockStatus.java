package co.ehealth.platform.pharmacy.dispensing;

// LOW means some usable stock exists but not enough for the remaining
// quantity; NONE means nothing usable at all (plan section 9, rule 9).
public enum StockStatus {
    IN_STOCK, LOW, NONE
}
