package co.ehealth.platform.pharmacy.dashboard;

import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityNotFoundException;
import co.ehealth.platform.facility.FacilityRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;

@Service
public class PharmacyDashboardService {

    private static final int MONTHS = 6;

    private final PharmacyDashboardRepository dashboardRepository;
    private final FacilityRepository facilityRepository;
    private final Clock clock;

    public PharmacyDashboardService(PharmacyDashboardRepository dashboardRepository,
                                    FacilityRepository facilityRepository, Clock clock) {
        this.dashboardRepository = dashboardRepository;
        this.facilityRepository = facilityRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<MonthlyMovement> monthlyMovements(UUID facilityId) {
        Facility facility = facilityRepository.findById(facilityId).orElseThrow(FacilityNotFoundException::new);
        ZoneId zone = ZoneId.of(facility.getTimezone());
        YearMonth currentMonth = YearMonth.now(clock.withZone(zone));
        YearMonth firstMonth = currentMonth.minusMonths(MONTHS - 1);
        Instant from = firstMonth.atDay(1).atStartOfDay(zone).toInstant();
        Instant to = currentMonth.plusMonths(1).atDay(1).atStartOfDay(zone).toInstant();
        Map<YearMonth, Long> counts = new HashMap<>();
        for (PharmacyDashboardRepository.MonthlyMovementView row :
                dashboardRepository.monthlyMovements(facilityId, zone.getId(), from, to)) {
            counts.put(YearMonth.parse(row.getMonth()), row.getTransactionCount());
        }
        return IntStream.range(0, MONTHS)
                .mapToObj(index -> firstMonth.plusMonths(index))
                .map(month -> new MonthlyMovement(month, counts.getOrDefault(month, 0L)))
                .toList();
    }

    public record MonthlyMovement(YearMonth month, long postedTransactions) {
    }
}
