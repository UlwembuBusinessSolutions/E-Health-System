package co.ehealth.platform.pharmacy.receiving;

import co.ehealth.platform.pharmacy.stock.PharmacyValidationException;

import java.math.BigDecimal;

// Cold-chain stock (vaccines, insulin) must arrive between 2 and 8 degrees
// in an intact cold box. A delivery outside that is not silently stocked:
// the receiver has to flag the line so the problem is on record and the
// affected quantity can be refused.
public final class ColdChainRule {

    static final BigDecimal MIN_SAFE_CELSIUS = new BigDecimal("2");
    static final BigDecimal MAX_SAFE_CELSIUS = new BigDecimal("8");

    private ColdChainRule() {
    }

    // Only an explicit "not intact" counts as a broken box: a missing answer
    // is not evidence of damage, whereas a missing temperature is rejected
    // outright because the reading is the whole point of the check.
    public static boolean isBreached(BigDecimal temperatureC, Boolean coldBoxIntact) {
        boolean outsideSafeRange = temperatureC.compareTo(MIN_SAFE_CELSIUS) < 0
                || temperatureC.compareTo(MAX_SAFE_CELSIUS) > 0;
        return outsideSafeRange || Boolean.FALSE.equals(coldBoxIntact);
    }

    public static void requireCompliantOrFlagged(String productName, BigDecimal temperatureC,
                                                 Boolean coldBoxIntact, boolean lineIsFlagged) {
        if (temperatureC == null) {
            throw new PharmacyValidationException("Record the temperature \"" + productName
                    + "\" arrived at. Cold-chain stock must be checked on receipt.");
        }
        if (isBreached(temperatureC, coldBoxIntact) && !lineIsFlagged) {
            throw new PharmacyValidationException("\"" + productName + "\" arrived at " + temperatureC.toPlainString()
                    + " °C or in a damaged cold box (it must be 2-8 °C in an intact box). "
                    + "Flag this line and say how many units you are accepting, if any.");
        }
    }
}
