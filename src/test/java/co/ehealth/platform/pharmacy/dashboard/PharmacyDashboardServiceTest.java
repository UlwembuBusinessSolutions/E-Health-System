package co.ehealth.platform.pharmacy.dashboard;

import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityRepository;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PharmacyDashboardServiceTest {

    private final PharmacyDashboardRepository dashboardRepository = mock(PharmacyDashboardRepository.class);
    private final FacilityRepository facilityRepository = mock(FacilityRepository.class);
    private final PharmacyDashboardService service = new PharmacyDashboardService(dashboardRepository,
            facilityRepository, Clock.fixed(Instant.parse("2026-11-24T08:00:00Z"), ZoneOffset.UTC));

    @Test
    void monthlyMovementSeriesIncludesQuietMonthsAndUsesTheFacilityCalendar() {
        UUID facilityId = UUID.randomUUID();
        Facility facility = mock(Facility.class);
        when(facility.getTimezone()).thenReturn("Africa/Johannesburg");
        when(facilityRepository.findById(facilityId)).thenReturn(Optional.of(facility));
        PharmacyDashboardRepository.MonthlyMovementView november =
                mock(PharmacyDashboardRepository.MonthlyMovementView.class);
        when(november.getMonth()).thenReturn("2026-11");
        when(november.getTransactionCount()).thenReturn(4L);
        when(dashboardRepository.monthlyMovements(eq(facilityId), eq("Africa/Johannesburg"),
                eq(Instant.parse("2026-05-31T22:00:00Z")), eq(Instant.parse("2026-11-30T22:00:00Z"))))
                .thenReturn(List.of(november));

        List<PharmacyDashboardService.MonthlyMovement> result = service.monthlyMovements(facilityId);

        assertEquals(6, result.size());
        assertEquals("2026-06", result.getFirst().month().toString());
        assertEquals(0, result.getFirst().postedTransactions());
        assertEquals(4, result.getLast().postedTransactions());
        verify(dashboardRepository).monthlyMovements(eq(facilityId), eq("Africa/Johannesburg"),
                eq(Instant.parse("2026-05-31T22:00:00Z")), eq(Instant.parse("2026-11-30T22:00:00Z")));
    }
}
