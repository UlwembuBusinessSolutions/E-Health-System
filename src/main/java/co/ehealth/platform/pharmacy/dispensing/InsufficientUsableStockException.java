package co.ehealth.platform.pharmacy.dispensing;

import java.util.List;

// "8 available, 20 needed" is not "out of stock" (plan section 9, rule 9), so
// the message always says how much IS usable, and names any expired lots
// that were set aside so the pharmacist knows why the shelf count and the
// usable count differ.
public class InsufficientUsableStockException extends DispensingConflictException {
    public InsufficientUsableStockException(long usable, int needed, List<LotAvailability> expiredLots) {
        super(describe(usable, needed, expiredLots));
    }

    private static String describe(long usable, int needed, List<LotAvailability> expiredLots) {
        StringBuilder message = new StringBuilder("Only " + usable + " of " + needed
                + " units are available in lots that are still in date.");
        for (LotAvailability lot : expiredLots) {
            message.append(" Lot ").append(lot.lotNumber()).append(" (").append(lot.available())
                    .append(" units) expired on ").append(DispensingFormats.date(lot.expiryDate())).append('.');
        }
        return message.toString();
    }
}
