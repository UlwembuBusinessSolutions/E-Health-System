package co.ehealth.platform.pharmacy.stock;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static co.ehealth.platform.pharmacy.PharmacyTestData.CLOCK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PharmacyLedgerTypeCountsTest {

    private final PharmacyStockEntryRepository entryRepository = mock(PharmacyStockEntryRepository.class);
    private final PharmacyLedgerQueryService service = new PharmacyLedgerQueryService(entryRepository,
            mock(LedgerRowAssembler.class), CLOCK);

    private final UUID facilityId = UUID.randomUUID();

    @Test
    void countsAreKeyedByTypeNameAndLeaveOutTypesWithNoEntries() {
        when(entryRepository.countByType(eq(facilityId), any(), any(), any(), eq(""), any(), any()))
                .thenReturn(List.of(new LedgerTypeCount(StockTransactionType.RECEIPT, 4),
                        new LedgerTypeCount(StockTransactionType.DISPENSE, 9)));
        var filter = new PharmacyLedgerQueryService.LedgerFilter(facilityId, null,
                List.of(StockTransactionType.RECEIPT), null, null, null, null, null);

        Map<String, Long> counts = service.typeCounts(filter);

        assertEquals(Map.of("RECEIPT", 4L, "DISPENSE", 9L), counts);
    }

    @Test
    void countsUseTheSameSearchAndDateFiltersAsTheListButNotItsTypeFilter() {
        UUID productId = UUID.randomUUID();
        var filter = new PharmacyLedgerQueryService.LedgerFilter(facilityId, productId,
                List.of(StockTransactionType.WRITE_OFF), null, null, "  Amox ", LocalDate.parse("2026-10-01"),
                LocalDate.parse("2026-10-03"));

        service.typeCounts(filter);

        verify(entryRepository).countByType(facilityId, productId, null, null, "amox",
                Instant.parse("2026-10-01T00:00:00Z"), Instant.parse("2026-10-04T00:00:00Z"));
    }
}
