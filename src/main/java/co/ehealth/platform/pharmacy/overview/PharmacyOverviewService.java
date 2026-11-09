package co.ehealth.platform.pharmacy.overview;

import co.ehealth.platform.facility.FacilityNotFoundException;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.pharmacy.stock.StockBaseUnit;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

// The pharmacy Overview tab: what is waiting, what runs out soon, what
// expires soon, and whether dispensing keeps up. Read-only, one facility.
//
// Days are the facility's own calendar days (its timezone), and history
// windows end at the start of today so a half-finished day never shows as a
// dip. Average use divides by the days the product has actually been stocked
// here (up to 30), not always by 30: a product loaded a week ago would
// otherwise look like it lasts four times longer than it will.
@Service
public class PharmacyOverviewService {

    static final int HISTORY_DAYS = 30;
    static final int EXPIRY_WINDOW_DAYS = 90;
    static final int EXPIRY_MONTHS = 6;
    static final int MAX_EXPIRING_LOTS = 200;
    static final int CRITICAL_BELOW_DAYS = 7;
    static final int WARNING_UP_TO_DAYS = 30;

    // Order matters: it is the sort order of the stock-cover list.
    public enum CoverLevel {
        OUT, CRITICAL, WARNING, OK, NO_RECENT_USE
    }

    public record Overview(LocalDate today, Waiting waiting, List<StockCover> stockCover, Expiry expiry,
                           List<DailyPrescriptions> prescriptionsPerDay) {
    }

    public record Waiting(long count, Instant oldestSince) {
    }

    // daysLeft is null when there is stock but no recent use to project from.
    public record StockCover(UUID productId, String code, String displayName, StockBaseUnit baseUnit,
                             long available, long used, int basisDays, Long daysLeft, CoverLevel level) {
    }

    public record Expiry(long within90Count, long expiredCount, LocalDate nextExpiry, List<ExpiryMonth> months,
                         List<ExpiringLot> lots, long totalLots) {
    }

    public record ExpiryMonth(YearMonth month, long within90Count, long laterCount) {
    }

    public record ExpiringLot(String productName, String lotNumber, LocalDate expiryDate, long quantity,
                              StockBaseUnit baseUnit, long daysLeft) {
    }

    public record DailyPrescriptions(LocalDate date, long received, long dispensed) {
    }

    private final PharmacyOverviewRepository repository;
    private final FacilityRepository facilityRepository;
    private final Clock clock;

    public PharmacyOverviewService(PharmacyOverviewRepository repository, FacilityRepository facilityRepository,
                                   Clock clock) {
        this.repository = repository;
        this.facilityRepository = facilityRepository;
        this.clock = clock;
    }

    public Overview overview(UUID facilityId) {
        ZoneId zone = ZoneId.of(facilityRepository.findById(facilityId).orElseThrow(FacilityNotFoundException::new)
                .getTimezone());
        LocalDate today = LocalDate.now(clock.withZone(zone));
        LocalDate historyStart = today.minusDays(HISTORY_DAYS);
        Instant historyFrom = historyStart.atStartOfDay(zone).toInstant();
        Instant historyTo = today.atStartOfDay(zone).toInstant();
        LocalDate horizon = today.plusDays(EXPIRY_WINDOW_DAYS);
        LocalDate until = YearMonth.from(today).plusMonths(EXPIRY_MONTHS - 1).atEndOfMonth();

        PharmacyOverviewRepository.WaitingView waiting = repository.waiting(facilityId);
        List<StockCover> cover = repository.stockCover(facilityId, today, horizon, historyFrom, historyTo).stream()
                .map(view -> cover(view, today, historyStart, zone))
                .sorted(COVER_ORDER)
                .toList();
        Expiry expiry = expiry(facilityId, today, horizon, until);
        List<DailyPrescriptions> perDay = perDay(historyStart, today,
                repository.receivedPerDay(facilityId, zone.getId(), historyFrom, historyTo),
                repository.dispensedPerDay(facilityId, zone.getId(), historyFrom, historyTo));

        return new Overview(today, new Waiting(waiting.getCount(), toInstant(waiting.getOldestSinceEpoch())), cover,
                expiry, perDay);
    }

    static final Comparator<StockCover> COVER_ORDER = Comparator.comparing(StockCover::level)
            .thenComparing(c -> c.daysLeft() == null ? Long.MAX_VALUE : c.daysLeft())
            .thenComparing(c -> c.displayName().toLowerCase());

    static StockCover cover(PharmacyOverviewRepository.CoverView view, LocalDate today, LocalDate historyStart,
                            ZoneId zone) {
        long available = view.getAvailable();
        // A window can hold more returns than issues (stock handed out before
        // it started, brought back during it); that is no use, not negative use.
        long used = Math.max(0, view.getUsed());
        int basisDays = basisDays(toInstant(view.getFirstStockedEpoch()), today, historyStart, zone);
        StockBaseUnit unit = StockBaseUnit.valueOf(view.getBaseUnit());

        if (available <= 0) {
            return new StockCover(view.getProductId(), view.getCode(), view.getDisplayName(), unit, 0, used, basisDays,
                    0L, CoverLevel.OUT);
        }
        if (used == 0 || basisDays == 0) {
            return new StockCover(view.getProductId(), view.getCode(), view.getDisplayName(), unit, available, used,
                    basisDays, null, CoverLevel.NO_RECENT_USE);
        }
        // available ÷ (used ÷ basisDays), in whole days, rounded down so the
        // warning comes early rather than late.
        long daysLeft = available * basisDays / used;
        CoverLevel level = daysLeft < CRITICAL_BELOW_DAYS ? CoverLevel.CRITICAL
                : daysLeft <= WARNING_UP_TO_DAYS ? CoverLevel.WARNING : CoverLevel.OK;
        return new StockCover(view.getProductId(), view.getCode(), view.getDisplayName(), unit, available, used,
                basisDays, daysLeft, level);
    }

    // Full days of history behind the average: from the later of the window
    // start and the day the product was first stocked here, up to yesterday.
    static int basisDays(Instant firstStocked, LocalDate today, LocalDate historyStart, ZoneId zone) {
        if (firstStocked == null) {
            return 0;
        }
        LocalDate firstDay = firstStocked.atZone(zone).toLocalDate();
        LocalDate start = firstDay.isAfter(historyStart) ? firstDay : historyStart;
        return (int) Math.max(0, ChronoUnit.DAYS.between(start, today));
    }

    private Expiry expiry(UUID facilityId, LocalDate today, LocalDate horizon, LocalDate until) {
        List<PharmacyOverviewRepository.ExpiringLotView> lotViews = repository.expiringLots(facilityId, today,
                horizon, until, MAX_EXPIRING_LOTS);
        List<ExpiringLot> lots = lotViews.stream().map(view -> {
            LocalDate expiryDate = LocalDate.parse(view.getExpiryDate());
            return new ExpiringLot(view.getProductName(), view.getLotNumber(), expiryDate, view.getQuantity(),
                    StockBaseUnit.valueOf(view.getBaseUnit()), ChronoUnit.DAYS.between(today, expiryDate));
        }).toList();
        long totalLots = lotViews.isEmpty() ? 0 : lotViews.getFirst().getTotalItems();

        Map<String, PharmacyOverviewRepository.ExpiryMonthView> byMonth = repository
                .expiryByMonth(facilityId, today, horizon, until).stream()
                .collect(Collectors.toMap(PharmacyOverviewRepository.ExpiryMonthView::getMonth, view -> view));
        List<ExpiryMonth> months = new ArrayList<>();
        long within90 = 0;
        for (int i = 0; i < EXPIRY_MONTHS; i++) {
            YearMonth month = YearMonth.from(today).plusMonths(i);
            PharmacyOverviewRepository.ExpiryMonthView view = byMonth.get(month.toString());
            long within = view == null ? 0 : view.getWithinCount();
            long later = view == null ? 0 : view.getLaterCount();
            within90 += within;
            months.add(new ExpiryMonth(month, within, later));
        }

        return new Expiry(within90, repository.expiredLotCount(facilityId, today, horizon),
                lots.isEmpty() ? null : lots.getFirst().expiryDate(), months, lots, totalLots);
    }

    // One row per day, oldest first, zero-filled so quiet days show as zero.
    static List<DailyPrescriptions> perDay(LocalDate historyStart, LocalDate today,
                                           List<PharmacyOverviewRepository.DayCountView> received,
                                           List<PharmacyOverviewRepository.DayCountView> dispensed) {
        Map<String, Long> receivedByDay = byDay(received);
        Map<String, Long> dispensedByDay = byDay(dispensed);
        List<DailyPrescriptions> days = new ArrayList<>();
        for (LocalDate day = historyStart; day.isBefore(today); day = day.plusDays(1)) {
            days.add(new DailyPrescriptions(day, receivedByDay.getOrDefault(day.toString(), 0L),
                    dispensedByDay.getOrDefault(day.toString(), 0L)));
        }
        return days;
    }

    private static Map<String, Long> byDay(List<PharmacyOverviewRepository.DayCountView> views) {
        return views.stream().collect(Collectors.toMap(PharmacyOverviewRepository.DayCountView::getDay,
                PharmacyOverviewRepository.DayCountView::getCount));
    }

    private static Instant toInstant(Long epochSeconds) {
        return epochSeconds == null ? null : Instant.ofEpochSecond(epochSeconds);
    }
}
