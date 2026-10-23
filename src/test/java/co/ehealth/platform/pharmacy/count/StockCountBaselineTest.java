package co.ehealth.platform.pharmacy.count;

import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.UUID;

import static co.ehealth.platform.pharmacy.count.CountTestFixtures.CLOCK;
import static co.ehealth.platform.pharmacy.count.CountTestFixtures.draftCount;
import static co.ehealth.platform.pharmacy.count.CountTestFixtures.ledgerLine;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class StockCountBaselineTest {

    private final StockCountLookup lookup = mock(StockCountLookup.class);
    private final CountLotBalances lotBalances = mock(CountLotBalances.class);
    private final PharmacyStockCountLineRepository lineRepository = mock(PharmacyStockCountLineRepository.class);
    private final StockCountRecordingService service = new StockCountRecordingService(lookup, lotBalances,
            mock(FoundLotBatches.class), mock(PharmacyProductRepository.class), lineRepository, CLOCK);

    private PharmacyStockCount count;
    private final UUID productId = UUID.randomUUID();

    @BeforeEach
    void openDraftCount() {
        count = draftCount(false);
        when(lookup.requireDraft(count.getId())).thenReturn(count);
    }

    private PharmacyStockCountLine lineFor(UUID batchId, String lot) {
        PharmacyStockCountLine line = ledgerLine(count, productId, batchId, lot);
        when(lookup.requireLine(count.getId(), line.getId())).thenReturn(line);
        return line;
    }

    @Test
    void baselineIsTheSystemBalanceAtTheMomentTheLineIsCounted() {
        UUID batchId = UUID.randomUUID();
        PharmacyStockCountLine line = lineFor(batchId, "LOT-A");
        when(lotBalances.balanceOf(count.getLocationId(), productId, batchId)).thenReturn(10L);

        service.recordCount(count.getId(), line.getId(), 8);

        assertEquals(10L, line.getBaselineQuantity());
        assertEquals(-2L, line.variance());
    }

    @Test
    void stockMovingAfterALineWasCountedNeverChangesItsVariance() {
        UUID batchA = UUID.randomUUID();
        UUID batchB = UUID.randomUUID();
        PharmacyStockCountLine lineA = lineFor(batchA, "LOT-A");
        PharmacyStockCountLine lineB = lineFor(batchB, "LOT-B");
        when(lotBalances.balanceOf(count.getLocationId(), productId, batchA)).thenReturn(10L);
        when(lotBalances.balanceOf(count.getLocationId(), productId, batchB)).thenReturn(20L);
        service.recordCount(count.getId(), lineA.getId(), 10);

        // Six units of lot A are dispensed while the rest of the shelf is still being counted.
        when(lotBalances.balanceOf(count.getLocationId(), productId, batchA)).thenReturn(4L);
        service.recordCount(count.getId(), lineB.getId(), 20);

        assertEquals(0L, lineA.variance());
        assertFalse(lineA.hasVariance());
        assertEquals(0L, lineB.variance());
    }

    @Test
    void recountingALineTakesAFreshBaseline() {
        UUID batchId = UUID.randomUUID();
        PharmacyStockCountLine line = lineFor(batchId, "LOT-A");
        when(lotBalances.balanceOf(count.getLocationId(), productId, batchId)).thenReturn(10L);
        service.recordCount(count.getId(), line.getId(), 9);

        when(lotBalances.balanceOf(count.getLocationId(), productId, batchId)).thenReturn(7L);
        service.recordCount(count.getId(), line.getId(), 7);

        assertEquals(7L, line.getBaselineQuantity());
        assertEquals(0L, line.variance());
    }

    @Test
    void foundLotHasZeroBaselineSoTheWholeQuantityIsTheVariance() {
        PharmacyStockCountLine found = PharmacyStockCountLine.forFoundLot(count.getId(), productId, "NEW-LOT",
                LocalDate.of(2027, 1, 31), 12, CLOCK.instant());

        assertTrue(found.isFoundInCount());
        assertEquals(0L, found.getBaselineQuantity());
        assertEquals(12L, found.variance());
    }

    @Test
    void negativeCountedQuantityIsRejected() {
        PharmacyStockCountLine line = lineFor(UUID.randomUUID(), "LOT-A");

        assertThrows(InvalidStockCountException.class,
                () -> service.recordCount(count.getId(), line.getId(), -1));
    }

    @Test
    void reasonCannotBeGivenBeforeTheLineIsCounted() {
        PharmacyStockCountLine line = lineFor(UUID.randomUUID(), "LOT-A");

        assertThrows(InvalidStockCountException.class,
                () -> service.recordReason(count.getId(), line.getId(), "Damaged in transit"));
    }
}
