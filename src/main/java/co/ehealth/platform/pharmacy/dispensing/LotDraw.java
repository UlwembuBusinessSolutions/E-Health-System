package co.ehealth.platform.pharmacy.dispensing;

// How many units one dispense takes from one lot.
public record LotDraw(LotAvailability lot, int quantity) {
}
