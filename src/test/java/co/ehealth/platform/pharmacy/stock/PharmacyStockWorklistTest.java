package co.ehealth.platform.pharmacy.stock;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PharmacyStockWorklistTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 4);

    private final UUID facilityId = UUID.randomUUID();
    private final PharmacyStockWorklistRepository repository = mock(PharmacyStockWorklistRepository.class);
    private final PharmacyStockWorklistService service = new PharmacyStockWorklistService(repository,
            Clock.fixed(Instant.parse("2026-10-04T10:00:00Z"), ZoneOffset.UTC));

    @Test
    void zeroAvailableIsOutRegardlessOfThreshold() {
        assertEquals(StockStatus.OUT, StockStatus.classify(0, 10));
        assertEquals(StockStatus.OUT, StockStatus.classify(0, null));
    }

    @Test
    void availableAtOrUnderTheThresholdIsLow() {
        assertEquals(StockStatus.LOW, StockStatus.classify(10, 10));
        assertEquals(StockStatus.LOW, StockStatus.classify(1, 10));
    }

    @Test
    void aboveTheThresholdOrWithoutOneIsInStock() {
        assertEquals(StockStatus.IN_STOCK, StockStatus.classify(11, 10));
        assertEquals(StockStatus.IN_STOCK, StockStatus.classify(1, null));
    }

    @Test
    void statusFilterIsCaseInsensitiveAndOptional() {
        assertEquals(Optional.of(StockStatusFilter.LOW), StockStatusFilter.parse("low"));
        assertEquals(Optional.of(StockStatusFilter.EXPIRING), StockStatusFilter.parse(" EXPIRING "));
        assertTrue(StockStatusFilter.parse(null).isEmpty());
        assertTrue(StockStatusFilter.parse("  ").isEmpty());
    }

    @Test
    void unknownStatusFilterIsRejectedWithTheValidValues() {
        InvalidStockRequestException error = assertThrows(InvalidStockRequestException.class,
                () -> StockStatusFilter.parse("HALF_EMPTY"));
        assertTrue(error.getMessage().contains("LOW, OUT or EXPIRING"));
    }

    @Test
    void stockListPassesTheStatusAndTrimmedLowerCaseSearchToTheQuery() {
        when(repository.listStock(eq(facilityId), eq("amox"), eq("OUT"), eq(TODAY), eq(TODAY.plusDays(90)), eq(50),
                eq(0))).thenReturn(List.of());

        Page<PharmacyStockWorklistService.StockListRow> page = service.listStock(facilityId, "  AMOX ",
                Optional.of(StockStatusFilter.OUT), 0, 50);

        assertEquals(0, page.getTotalElements());
        verify(repository).listStock(eq(facilityId), eq("amox"), eq("OUT"), eq(TODAY), eq(TODAY.plusDays(90)),
                eq(50), eq(0));
    }

    @Test
    void stockListRowsCarryTheStatusAndTheGrandTotal() {
        var view = mock(PharmacyStockWorklistRepository.StockRowView.class);
        when(view.getProductId()).thenReturn(UUID.randomUUID());
        when(view.getBaseUnit()).thenReturn("TABLET");
        when(view.getAvailable()).thenReturn(8L);
        when(view.getReorderThreshold()).thenReturn(10);
        when(view.getNextExpiry()).thenReturn("2026-11-01");
        when(view.getTotalItems()).thenReturn(120L);
        when(repository.listStock(eq(facilityId), eq(""), eq(""), eq(TODAY), eq(TODAY.plusDays(90)), anyInt(),
                anyInt())).thenReturn(List.of(view));

        Page<PharmacyStockWorklistService.StockListRow> page = service.listStock(facilityId, null, Optional.empty(),
                0, 50);

        assertEquals(120, page.getTotalElements());
        assertEquals(StockStatus.LOW, page.getContent().getFirst().status());
        assertEquals(LocalDate.of(2026, 11, 1), page.getContent().getFirst().nextExpiry());
    }

    @Test
    void expiryRowsAreMarkedExpiredWhenTheirDateHasPassed() {
        var expired = expiryLot("2026-10-01");
        var expiring = expiryLot("2026-10-20");
        when(repository.listExpiringLots(eq(facilityId), eq(TODAY), eq(TODAY.plusDays(30)), anyInt(), anyInt()))
                .thenReturn(List.of(expired, expiring));

        List<PharmacyStockWorklistService.ExpiryLotRow> rows = service.listExpiringLots(facilityId, 30, 0, 50)
                .getContent();

        assertTrue(rows.get(0).expired());
        assertEquals(-3, rows.get(0).daysToExpiry());
        assertFalse(rows.get(1).expired());
        assertEquals(16, rows.get(1).daysToExpiry());
    }

    @Test
    void negativeExpiryWindowIsRejected() {
        assertThrows(InvalidStockRequestException.class, () -> service.listExpiringLots(facilityId, -1, 0, 50));
    }

    private PharmacyStockWorklistRepository.ExpiryLotView expiryLot(String expiryDate) {
        var view = mock(PharmacyStockWorklistRepository.ExpiryLotView.class);
        when(view.getExpiryDate()).thenReturn(expiryDate);
        when(view.getTotalItems()).thenReturn(2L);
        return view;
    }
}
