package co.ehealth.platform.pharmacy.count;

import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static co.ehealth.platform.pharmacy.count.CountTestFixtures.NOW;
import static co.ehealth.platform.pharmacy.count.CountTestFixtures.countedLine;
import static co.ehealth.platform.pharmacy.count.CountTestFixtures.draftCount;
import static co.ehealth.platform.pharmacy.count.CountTestFixtures.product;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class StockCountBlindTest {

    private final PharmacyStockCountRepository countRepository = mock(PharmacyStockCountRepository.class);
    private final PharmacyStockCountLineRepository lineRepository = mock(PharmacyStockCountLineRepository.class);
    private final PharmacyProductRepository productRepository = mock(PharmacyProductRepository.class);
    private final CountLotBalances lotBalances = mock(CountLotBalances.class);
    private final StockCountLookup lookup = mock(StockCountLookup.class);
    private final StockCountQueryService service = new StockCountQueryService(countRepository, lineRepository,
            productRepository, lotBalances, lookup);

    private final UUID productId = UUID.randomUUID();

    private StockCountResponse detailOf(PharmacyStockCount count) {
        PharmacyStockCountLine line = countedLine(count, productId, UUID.randomUUID(), 100, 60);
        when(lookup.requireCount(count.getId())).thenReturn(count);
        when(lineRepository.findByCountId(count.getId())).thenReturn(List.of(line));
        when(productRepository.findAllById(List.of(productId))).thenReturn(List.of(product(productId, "Amoxicillin")));
        return service.detail(count.getId());
    }

    @Test
    void blindDraftHidesEverythingThatWouldRevealTheSystemQuantity() {
        StockCountResponse response = detailOf(draftCount(true));

        StockCountLineResponse line = response.lines().get(0);
        assertEquals(60L, line.countedQuantity());
        assertNull(line.baselineQuantity());
        assertNull(line.expectedQuantity());
        assertNull(line.variance());
        assertNull(line.large());
        assertNull(response.matches());
        assertNull(response.differences());
        assertEquals(1, response.lotsCounted());
    }

    @Test
    void visibleDraftShowsBaselineVarianceAndLargeFlag() {
        StockCountResponse response = detailOf(draftCount(false));

        StockCountLineResponse line = response.lines().get(0);
        assertEquals(100L, line.baselineQuantity());
        assertEquals(-40L, line.variance());
        assertTrue(line.large());
        assertEquals(0, response.matches());
        assertEquals(1, response.differences());
    }

    @Test
    void blindCountRevealsBaselinesOnceItIsPosted() {
        PharmacyStockCount count = draftCount(true);
        count.markPosted("CNT-000001", UUID.randomUUID(), "Sipho Dlamini", NOW);

        StockCountResponse response = detailOf(count);

        assertNotNull(response.lines().get(0).baselineQuantity());
        assertEquals(-40L, response.lines().get(0).variance());
        assertEquals("CNT-000001", response.reference());
    }
}
