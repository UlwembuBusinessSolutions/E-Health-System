package co.ehealth.platform.pharmacy.count;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CountVarianceTest {

    @Test
    void noDifferenceIsNeverLarge() {
        assertFalse(CountVariance.isLarge(100, 0));
    }

    @Test
    void smallPercentageOfBaselineIsNotLarge() {
        assertFalse(CountVariance.isLarge(100, -10));
    }

    @Test
    void moreThanTenPercentOfBaselineIsLarge() {
        assertTrue(CountVariance.isLarge(100, -11));
        assertTrue(CountVariance.isLarge(100, 11));
    }

    @Test
    void moreThanFiftyUnitsIsLargeEvenWhenUnderTenPercent() {
        assertFalse(CountVariance.isLarge(1000, -50));
        assertTrue(CountVariance.isLarge(1000, -51));
    }

    @Test
    void anythingFoundWhereNothingWasExpectedIsLarge() {
        assertTrue(CountVariance.isLarge(0, 3));
    }
}
