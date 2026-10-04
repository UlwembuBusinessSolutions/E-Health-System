package co.ehealth.platform.pharmacy.stock;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.ToLongFunction;

// The pharmacist's worklists: what is low, out, expiring or expired. Pure
// read side — quantities only ever change through PharmacyStockLedgerService.
@Service
public class PharmacyStockWorklistService {

    public static final int DEFAULT_EXPIRY_WINDOW_DAYS = 90;

    private final PharmacyStockWorklistRepository worklistRepository;
    private final Clock clock;

    public PharmacyStockWorklistService(PharmacyStockWorklistRepository worklistRepository, Clock clock) {
        this.worklistRepository = worklistRepository;
        this.clock = clock;
    }

    public record StockListRow(UUID productId, String code, String displayName, StockBaseUnit baseUnit,
                               long available, Integer reorderThreshold, StockStatus status, LocalDate nextExpiry,
                               long lotCount, boolean archived) {
    }

    public record ExpiryLotRow(UUID productId, String productName, String productCode, UUID batchId,
                               String lotNumber, LocalDate expiryDate, long quantity, long daysToExpiry,
                               boolean expired) {
    }

    public record DashboardCounts(long lowCount, long outCount, long expiringCount, long expiredCount,
                                  long awaitingCollectionCount) {
    }

    public Page<StockListRow> listStock(UUID facilityId, String q, Optional<StockStatusFilter> status, int page,
                                        int size) {
        Pageable pageable = StockListParams.pageable(page, size);
        LocalDate today = LocalDate.now(clock);
        List<PharmacyStockWorklistRepository.StockRowView> rows = worklistRepository.listStock(facilityId,
                StockListParams.searchTerm(q), status.map(Enum::name).orElse(""), today,
                today.plusDays(DEFAULT_EXPIRY_WINDOW_DAYS), pageable.getPageSize(), (int) pageable.getOffset());
        return pageOf(rows, pageable, PharmacyStockWorklistRepository.StockRowView::getTotalItems,
                PharmacyStockWorklistService::toStockListRow);
    }

    public DashboardCounts dashboard(UUID facilityId) {
        LocalDate today = LocalDate.now(clock);
        PharmacyStockWorklistRepository.DashboardCountsView counts = worklistRepository.dashboardCounts(facilityId,
                today, today.plusDays(DEFAULT_EXPIRY_WINDOW_DAYS));
        return new DashboardCounts(counts.getLowCount(), counts.getOutCount(), counts.getExpiringCount(),
                counts.getExpiredCount(), counts.getAwaitingCollectionCount());
    }

    // Expired lots plus lots expiring within `days`, earliest first.
    public Page<ExpiryLotRow> listExpiringLots(UUID facilityId, int days, int page, int size) {
        if (days < 0) {
            throw new InvalidStockRequestException("The number of days must be zero or more.");
        }
        Pageable pageable = StockListParams.pageable(page, size);
        LocalDate today = LocalDate.now(clock);
        List<PharmacyStockWorklistRepository.ExpiryLotView> rows = worklistRepository.listExpiringLots(facilityId,
                today, today.plusDays(days), pageable.getPageSize(), (int) pageable.getOffset());
        return pageOf(rows, pageable, PharmacyStockWorklistRepository.ExpiryLotView::getTotalItems,
                row -> toExpiryLotRow(row, today));
    }

    private static StockListRow toStockListRow(PharmacyStockWorklistRepository.StockRowView row) {
        return new StockListRow(row.getProductId(), row.getCode(), row.getDisplayName(),
                StockBaseUnit.valueOf(row.getBaseUnit()), row.getAvailable(), row.getReorderThreshold(),
                StockStatus.classify(row.getAvailable(), row.getReorderThreshold()),
                row.getNextExpiry() == null ? null : LocalDate.parse(row.getNextExpiry()), row.getLotCount(),
                row.getArchived());
    }

    private static ExpiryLotRow toExpiryLotRow(PharmacyStockWorklistRepository.ExpiryLotView row, LocalDate today) {
        LocalDate expiryDate = LocalDate.parse(row.getExpiryDate());
        long daysToExpiry = ChronoUnit.DAYS.between(today, expiryDate);
        return new ExpiryLotRow(row.getProductId(), row.getProductName(), row.getProductCode(), row.getBatchId(),
                row.getLotNumber(), expiryDate, row.getQuantity(), daysToExpiry, daysToExpiry < 0);
    }

    // The grand total rides on every row (see the repository's conventions),
    // so an empty page — nothing matched, or a page past the end — reports 0.
    private static <V, T> Page<T> pageOf(List<V> rows, Pageable pageable, ToLongFunction<V> totalOf,
                                          Function<V, T> toItem) {
        long total = rows.isEmpty() ? 0 : totalOf.applyAsLong(rows.getFirst());
        return new PageImpl<>(rows.stream().map(toItem).toList(), pageable, total);
    }
}
