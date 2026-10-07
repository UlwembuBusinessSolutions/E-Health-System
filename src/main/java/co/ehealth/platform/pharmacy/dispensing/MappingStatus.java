package co.ehealth.platform.pharmacy.dispensing;

// CONFIRMED: the prescriber chose the stock product for this item. UNMAPPED: an
// older line written as free text. Only a prescriber chooses medicines, so the
// pharmacy cannot dispense an UNMAPPED line until the prescriber corrects it.
public enum MappingStatus {
    CONFIRMED, UNMAPPED
}
