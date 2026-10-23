package co.ehealth.platform.pharmacy.dispensing;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class DispensingReturnLimitsTest {

    private final ReturnPlanner planner = new ReturnPlanner();
    private final UUID itemId = UUID.randomUUID();
    private final UUID lotA = UUID.randomUUID();
    private final UUID lotB = UUID.randomUUID();

    private DispenseAllocation allocation(UUID batchId, int quantity) {
        return new DispenseAllocation(itemId, batchId, quantity, UUID.randomUUID(), UUID.randomUUID(),
                Instant.parse("2026-10-04T08:00:00Z"));
    }

    private PrescriptionReturn returned(UUID batchId, int quantity) {
        return new PrescriptionReturn(itemId, batchId, quantity, ReturnCondition.UNOPENED, "changed mind", null,
                UUID.randomUUID(), Instant.parse("2026-10-04T09:00:00Z"));
    }

    @Test
    void returnsAgainstTheMostRecentlyDispensedLotFirst() {
        List<ReturnPlanner.LotReturn> plan = planner.plan(List.of(allocation(lotA, 5), allocation(lotB, 5)),
                List.of(), 3);

        assertEquals(List.of(new ReturnPlanner.LotReturn(lotB, 3)), plan);
    }

    @Test
    void aReturnLargerThanOneLotSpillsIntoTheEarlierLot() {
        List<ReturnPlanner.LotReturn> plan = planner.plan(List.of(allocation(lotA, 5), allocation(lotB, 5)),
                List.of(), 7);

        assertEquals(List.of(new ReturnPlanner.LotReturn(lotB, 5), new ReturnPlanner.LotReturn(lotA, 2)), plan);
    }

    @Test
    void cannotReturnMoreThanWasDispensed() {
        DispensingValidationException thrown = assertThrows(DispensingValidationException.class,
                () -> planner.plan(List.of(allocation(lotA, 10)), List.of(), 11));

        assertTrue(thrown.getMessage().contains("10"));
    }

    @Test
    void earlierReturnsReduceWhatCanStillBeReturned() {
        List<DispenseAllocation> allocations = List.of(allocation(lotA, 10));
        List<PrescriptionReturn> earlier = List.of(returned(lotA, 4));

        assertEquals(6, planner.totalReturnable(allocations, earlier));
        assertThrows(DispensingValidationException.class, () -> planner.plan(allocations, earlier, 7));
        assertEquals(List.of(new ReturnPlanner.LotReturn(lotA, 6)), planner.plan(allocations, earlier, 6));
    }

    @Test
    void aFullyReturnedItemSaysEverythingWasAlreadyReturned() {
        DispensingValidationException thrown = assertThrows(DispensingValidationException.class,
                () -> planner.plan(List.of(allocation(lotA, 3)), List.of(returned(lotA, 3)), 1));

        assertTrue(thrown.getMessage().contains("already been returned"));
    }

    @Test
    void anExhaustedLotIsSkippedAndTheNextOneUsed() {
        List<ReturnPlanner.LotReturn> plan = planner.plan(List.of(allocation(lotA, 5), allocation(lotB, 5)),
                List.of(returned(lotB, 5)), 2);

        assertEquals(List.of(new ReturnPlanner.LotReturn(lotA, 2)), plan);
    }
}
