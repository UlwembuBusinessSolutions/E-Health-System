package co.ehealth.platform.pharmacy.count;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CountAreasTest {

    @Test
    void eachDistinctStorageInstructionIsAnAreaWithItsLotCount() {
        List<CountAreas.Area> areas = CountAreas.derive(
                List.of("Fridge 2-8 C", "Shelf B", "Fridge 2-8 C", "fridge 2-8 c"));

        assertEquals(List.of(new CountAreas.Area("Fridge 2-8 C", 3), new CountAreas.Area("Shelf B", 1)), areas);
    }

    @Test
    void lotsWithoutStorageInstructionsBelongToNoArea() {
        List<String> storage = new ArrayList<>(Arrays.asList(null, " ", "Shelf B"));

        assertEquals(List.of(new CountAreas.Area("Shelf B", 1)), CountAreas.derive(storage));
    }

    @Test
    void lotCountFollowsTheSameContainsRuleAsAnAreaCount() {
        List<CountAreas.Area> areas = CountAreas.derive(List.of("Fridge", "Fridge door shelf"));

        assertEquals(List.of(new CountAreas.Area("Fridge", 2), new CountAreas.Area("Fridge door shelf", 1)), areas);
    }

    @Test
    void noStockMeansNoAreas() {
        assertTrue(CountAreas.derive(List.of()).isEmpty());
    }
}
