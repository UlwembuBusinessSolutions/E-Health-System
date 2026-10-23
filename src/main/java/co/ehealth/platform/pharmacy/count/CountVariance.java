package co.ehealth.platform.pharmacy.count;

// A variance is "large" when it is worth a second look before posting. It
// only ever flags the line — a large variance never blocks the count,
// because the pharmacist may well be right.
public final class CountVariance {

    static final long LARGE_UNITS = 50;
    static final long LARGE_PERCENT_OF_BASELINE = 10;

    private CountVariance() {
    }

    public static boolean isLarge(long baselineQuantity, long variance) {
        long size = Math.abs(variance);
        if (size == 0) {
            return false;
        }
        boolean overUnitLimit = size > LARGE_UNITS;
        boolean overPercentLimit = size * 100 > baselineQuantity * LARGE_PERCENT_OF_BASELINE;
        return overUnitLimit || overPercentLimit;
    }
}
