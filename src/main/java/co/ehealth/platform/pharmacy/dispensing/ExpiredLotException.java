package co.ehealth.platform.pharmacy.dispensing;

// Chosen explicitly by the pharmacist, so the refusal names the lot rather
// than silently picking another one behind their back.
public class ExpiredLotException extends DispensingConflictException {
    public ExpiredLotException(LotAvailability lot) {
        super("Lot " + lot.lotNumber() + " expired on " + DispensingFormats.date(lot.expiryDate())
                + " and cannot be dispensed. Pick a lot that is still in date.");
    }
}
