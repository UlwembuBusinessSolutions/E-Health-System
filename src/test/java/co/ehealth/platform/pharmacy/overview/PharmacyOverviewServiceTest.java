package co.ehealth.platform.pharmacy.overview;

import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.pharmacy.overview.PharmacyOverviewService.CoverLevel;
import co.ehealth.platform.pharmacy.overview.PharmacyOverviewService.StockCover;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PharmacyOverviewServiceTest {

    private static final ZoneId JOBURG = ZoneId.of("Africa/Johannesburg");
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 14);
    private static final LocalDate HISTORY_START = TODAY.minusDays(30);

    private final UUID facilityId = UUID.randomUUID();
    private final PharmacyOverviewRepository repository = mock(PharmacyOverviewRepository.class);
    private final FacilityRepository facilityRepository = mock(FacilityRepository.class);

    @Test
    void averageUseDividesByTheDaysTheProductHasBeenStockedHere() {
        // Stocked 7 days ago, 70 used since: 10 a day, so 50 on hand lasts 5 days.
        StockCover cover = cover(50, 70, TODAY.minusDays(7));

        assertEquals(7, cover.basisDays());
        assertEquals(5L, cover.daysLeft());
        assertEquals(CoverLevel.CRITICAL, cover.level());
    }

    @Test
    void averageUseCapsTheHistoryAtThirtyDays() {
        // 300 used over the last 30 days is 10 a day: 450 lasts 45 days.
        StockCover cover = cover(450, 300, TODAY.minusDays(200));

        assertEquals(30, cover.basisDays());
        assertEquals(45L, cover.daysLeft());
        assertEquals(CoverLevel.OK, cover.level());
    }

    @Test
    void daysLeftRoundsDownSoTheWarningComesEarly() {
        // 20 on hand at 6 a day is 3.33 days.
        assertEquals(3L, cover(20, 180, TODAY.minusDays(60)).daysLeft());
    }

    @Test
    void levelBoundariesAreUnderSevenAndUpToThirtyDays() {
        // 30 days of history and 30 used is exactly 1 a day, so on hand = days left.
        assertEquals(CoverLevel.CRITICAL, cover(6, 30, TODAY.minusDays(60)).level());
        assertEquals(CoverLevel.WARNING, cover(7, 30, TODAY.minusDays(60)).level());
        assertEquals(CoverLevel.WARNING, cover(30, 30, TODAY.minusDays(60)).level());
        assertEquals(CoverLevel.OK, cover(31, 30, TODAY.minusDays(60)).level());
    }

    @Test
    void nothingOnHandIsOutWhateverTheUse() {
        StockCover out = cover(0, 0, null);

        assertEquals(CoverLevel.OUT, out.level());
        assertEquals(0L, out.daysLeft());
    }

    @Test
    void stockWithoutRecentUseHasNoProjection() {
        StockCover idle = cover(100, 0, TODAY.minusDays(60));

        assertEquals(CoverLevel.NO_RECENT_USE, idle.level());
        assertNull(idle.daysLeft());
    }

    @Test
    void moreReturnsThanIssuesCountsAsNoUseNotNegativeUse() {
        assertEquals(CoverLevel.NO_RECENT_USE, cover(100, -12, TODAY.minusDays(60)).level());
    }

    @Test
    void stockFirstLoadedTodayHasNoHistoryYet() {
        StockCover fresh = cover(100, 0, TODAY);

        assertEquals(0, fresh.basisDays());
        assertEquals(CoverLevel.NO_RECENT_USE, fresh.level());
    }

    @Test
    void coverListPutsOutOfStockFirstThenFewestDaysAndIdleStockLast() {
        List<StockCover> sorted = List.of(
                named("Idle", 100, 0), named("Plenty", 450, 300), named("Out", 0, 10),
                named("Soon b", 20, 60), named("Soon a", 20, 60), named("Short", 3, 30)).stream()
                .sorted(PharmacyOverviewService.COVER_ORDER).toList();

        assertEquals(List.of("Out", "Short", "Soon a", "Soon b", "Plenty", "Idle"),
                sorted.stream().map(StockCover::displayName).toList());
    }

    @Test
    void prescriptionsPerDayCoverThirtyFullDaysOldestFirstWithZeroesFilledIn() {
        var received = List.of(dayCount("2026-10-13", 44), dayCount("2026-09-14", 45));
        var dispensed = List.of(dayCount("2026-10-13", 40));

        var days = PharmacyOverviewService.perDay(HISTORY_START, TODAY, received, dispensed);

        assertEquals(30, days.size());
        assertEquals(LocalDate.of(2026, 9, 14), days.getFirst().date());
        assertEquals(45, days.getFirst().received());
        assertEquals(0, days.getFirst().dispensed());
        assertEquals(LocalDate.of(2026, 10, 13), days.getLast().date());
        assertEquals(44, days.getLast().received());
        assertEquals(40, days.getLast().dispensed());
        assertEquals(0, days.get(15).received());
    }

    @Test
    void historyWindowRunsMidnightToMidnightInTheFacilitysTimezone() {
        // 23:30 UTC on 13 Oct is already 01:30 on 14 Oct in Johannesburg.
        PharmacyOverviewService service = serviceAt("2026-10-13T23:30:00Z");

        PharmacyOverviewService.Overview overview = service.overview(facilityId);

        assertEquals(TODAY, overview.today());
        Instant from = Instant.parse("2026-09-13T22:00:00Z");
        Instant to = Instant.parse("2026-10-13T22:00:00Z");
        verify(repository).receivedPerDay(facilityId, "Africa/Johannesburg", from, to);
        verify(repository).dispensedPerDay(facilityId, "Africa/Johannesburg", from, to);
        verify(repository).stockCover(facilityId, TODAY, TODAY.plusDays(90), from, to);
    }

    @Test
    void expiryMonthsRunSixMonthsFromThisOneWithEmptyMonthsAsZero() {
        PharmacyOverviewService service = serviceAt("2026-10-14T08:00:00Z");
        var months = List.of(month("2026-11", 2, 0), month("2027-01", 1, 3));
        when(repository.expiryByMonth(eq(facilityId), eq(TODAY), eq(TODAY.plusDays(90)),
                eq(LocalDate.of(2027, 3, 31)))).thenReturn(months);
        var lot = expiringLot("2026-10-31", 1);
        when(repository.expiringLots(eq(facilityId), eq(TODAY), eq(TODAY.plusDays(90)), eq(LocalDate.of(2027, 3, 31)),
                anyInt())).thenReturn(List.of(lot));
        when(repository.expiredLotCount(facilityId, TODAY, TODAY.plusDays(90))).thenReturn(2L);

        PharmacyOverviewService.Expiry expiry = service.overview(facilityId).expiry();

        assertEquals(List.of(YearMonth.of(2026, 10), YearMonth.of(2026, 11), YearMonth.of(2026, 12),
                YearMonth.of(2027, 1), YearMonth.of(2027, 2), YearMonth.of(2027, 3)),
                expiry.months().stream().map(PharmacyOverviewService.ExpiryMonth::month).toList());
        assertEquals(0, expiry.months().getFirst().within90Count());
        assertEquals(1, expiry.months().get(3).within90Count());
        assertEquals(3, expiry.months().get(3).laterCount());
        assertEquals(3, expiry.within90Count());
        assertEquals(2, expiry.expiredCount());
        assertEquals(LocalDate.of(2026, 10, 31), expiry.nextExpiry());
        assertEquals(17, expiry.lots().getFirst().daysLeft());
    }

    private PharmacyOverviewService serviceAt(String instant) {
        Facility facility = mock(Facility.class);
        when(facility.getTimezone()).thenReturn("Africa/Johannesburg");
        when(facilityRepository.findById(facilityId)).thenReturn(Optional.of(facility));
        PharmacyOverviewRepository.WaitingView waiting = mock(PharmacyOverviewRepository.WaitingView.class);
        when(repository.waiting(facilityId)).thenReturn(waiting);
        when(repository.stockCover(any(), any(), any(), any(), any())).thenReturn(List.of());
        when(repository.receivedPerDay(any(), anyString(), any(), any())).thenReturn(List.of());
        when(repository.dispensedPerDay(any(), anyString(), any(), any())).thenReturn(List.of());
        return new PharmacyOverviewService(repository, facilityRepository,
                Clock.fixed(Instant.parse(instant), ZoneOffset.UTC));
    }

    private static StockCover cover(long available, long used, LocalDate firstStocked) {
        return PharmacyOverviewService.cover(coverView("Product", available, used, firstStocked), TODAY,
                HISTORY_START, JOBURG);
    }

    // 60 days of history behind every row, so used / 30 is the daily use.
    private static StockCover named(String name, long available, long used) {
        return PharmacyOverviewService.cover(coverView(name, available, used, TODAY.minusDays(60)), TODAY,
                HISTORY_START, JOBURG);
    }

    private static PharmacyOverviewRepository.CoverView coverView(String name, long available, long used,
                                                                  LocalDate firstStocked) {
        var view = mock(PharmacyOverviewRepository.CoverView.class);
        when(view.getProductId()).thenReturn(UUID.randomUUID());
        when(view.getDisplayName()).thenReturn(name);
        when(view.getBaseUnit()).thenReturn("TABLET");
        when(view.getAvailable()).thenReturn(available);
        when(view.getUsed()).thenReturn(used);
        when(view.getFirstStockedEpoch()).thenReturn(firstStocked == null ? null
                : firstStocked.atTime(10, 0).atZone(JOBURG).toEpochSecond());
        return view;
    }

    private static PharmacyOverviewRepository.DayCountView dayCount(String day, long count) {
        var view = mock(PharmacyOverviewRepository.DayCountView.class);
        when(view.getDay()).thenReturn(day);
        when(view.getCount()).thenReturn(count);
        return view;
    }

    private static PharmacyOverviewRepository.ExpiryMonthView month(String month, long within, long later) {
        var view = mock(PharmacyOverviewRepository.ExpiryMonthView.class);
        when(view.getMonth()).thenReturn(month);
        when(view.getWithinCount()).thenReturn(within);
        when(view.getLaterCount()).thenReturn(later);
        return view;
    }

    private static PharmacyOverviewRepository.ExpiringLotView expiringLot(String expiryDate, long total) {
        var view = mock(PharmacyOverviewRepository.ExpiringLotView.class);
        when(view.getProductName()).thenReturn("Cetirizine 10 mg tablets");
        when(view.getLotNumber()).thenReturn("CT2410");
        when(view.getExpiryDate()).thenReturn(expiryDate);
        when(view.getQuantity()).thenReturn(30L);
        when(view.getBaseUnit()).thenReturn("TABLET");
        when(view.getTotalItems()).thenReturn(total);
        return view;
    }
}
