package co.ehealth.platform.pharmacy;

import co.ehealth.platform.pharmacy.reorder.ReorderStatus;
import co.ehealth.platform.pharmacy.reorder.ReorderSuggestion;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PharmacyReorderSuggestionTest {

    @ParameterizedTest(name = "target {0}, on hand {1}, pack {2} -> order {3}")
    @CsvSource({
            "100, 40, 30, 60",
            "100, 41, 30, 60",
            "100, 10, 30, 90",
            "100, 0, 30, 120",
            "90, 0, 30, 90",
            "100, 99, 30, 30",
            "100, 40, 1, 60",
            "100, 40, 0, 60"
    })
    void roundsTheShortfallUpToWholePacks(int target, long onHand, int packSize, int expected) {
        assertEquals(expected, ReorderSuggestion.suggestedQuantity(target, onHand, packSize));
    }

    @Test
    void ordersTheExactShortfallWhenPackSizeIsUnknown() {
        assertEquals(37, ReorderSuggestion.suggestedQuantity(50, 13, null));
    }

    @Test
    void ordersNothingAtOrAboveTarget() {
        assertEquals(0, ReorderSuggestion.suggestedQuantity(100, 100, 30));
        assertEquals(0, ReorderSuggestion.suggestedQuantity(100, 250, 30));
    }

    @Test
    void ordersNothingWhenNoTargetIsSet() {
        assertEquals(0, ReorderSuggestion.suggestedQuantity(null, 0, 30));
    }

    @Test
    void statusIsOutWhenNothingIsOnTheShelf() {
        assertEquals(ReorderStatus.OUT, ReorderSuggestion.statusOf(0, 20));
        assertEquals(ReorderStatus.OUT, ReorderSuggestion.statusOf(0, null));
    }

    @Test
    void statusIsLowAtOrBelowTheThreshold() {
        assertEquals(ReorderStatus.LOW, ReorderSuggestion.statusOf(20, 20));
        assertEquals(ReorderStatus.LOW, ReorderSuggestion.statusOf(5, 20));
    }

    @Test
    void statusIsOkAboveTheThresholdOrWithoutOne() {
        assertEquals(ReorderStatus.OK, ReorderSuggestion.statusOf(21, 20));
        assertEquals(ReorderStatus.OK, ReorderSuggestion.statusOf(3, null));
    }
}
