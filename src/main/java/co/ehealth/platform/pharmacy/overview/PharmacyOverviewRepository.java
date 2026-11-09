package co.ehealth.platform.pharmacy.overview;

import co.ehealth.platform.pharmacy.stock.PharmacyStockAccount;
import co.ehealth.platform.pharmacy.stock.PharmacyStockWorklistRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

// The reads behind the pharmacy Overview tab. Same conventions as
// PharmacyStockWorklistRepository (whose FACILITY_STOCK_CTE is reused so
// "what a facility holds" has one definition): '' never NULL for strings,
// dates come back as ISO text and timestamps as epoch seconds (a quoted
// "HH24:MI" format would read as a :MI parameter), aliases are quoted.
//
// "Used" means units that left the shelf for patients: every ledger line on
// a patient-linked transaction (dispense, return to shelf, damaged-return
// write-off), plus reversals of those. Adjustments, counts and receipts are
// not use.
public interface PharmacyOverviewRepository extends Repository<PharmacyStockAccount, UUID> {

    @Query(value = PharmacyStockWorklistRepository.FACILITY_STOCK_CTE
            + ", used AS ("
            + "SELECT a.product_id AS product_id, SUM(-e.quantity_delta) AS used "
            + "FROM pharmacy_stock_entries e "
            + "JOIN pharmacy_stock_transactions t ON t.id = e.transaction_id "
            + "LEFT JOIN pharmacy_stock_transactions o ON o.id = t.reversal_of_transaction_id "
            + "JOIN pharmacy_stock_accounts a ON a.id = e.stock_account_id AND a.bucket = 'AVAILABLE' "
            + "WHERE t.facility_id = :facilityId AND t.created_at >= :usageFrom AND t.created_at < :usageTo "
            + "AND (t.prescription_serial IS NOT NULL OR o.prescription_serial IS NOT NULL) "
            + "GROUP BY a.product_id), "
            + "first_stocked AS ("
            + "SELECT a.product_id AS product_id, MIN(t.created_at) AS first_at "
            + "FROM pharmacy_stock_entries e "
            + "JOIN pharmacy_stock_transactions t ON t.id = e.transaction_id "
            + "JOIN pharmacy_stock_accounts a ON a.id = e.stock_account_id "
            + "WHERE t.facility_id = :facilityId AND e.quantity_delta > 0 "
            + "GROUP BY a.product_id) "
            + "SELECT p.id AS \"productId\", p.code AS \"code\", p.display_name AS \"displayName\", "
            + "p.base_unit AS \"baseUnit\", CAST(COALESCE(bal.available, 0) AS BIGINT) AS \"available\", "
            + "CAST(COALESCE(u.used, 0) AS BIGINT) AS \"used\", "
            + "CAST(FLOOR(EXTRACT(EPOCH FROM fs.first_at)) AS BIGINT) AS \"firstStockedEpoch\" "
            + "FROM pharmacy_facility_products fp "
            + "JOIN pharmacy_products p ON p.id = fp.product_id AND p.active "
            + "LEFT JOIN balances bal ON bal.product_id = fp.product_id "
            + "LEFT JOIN used u ON u.product_id = fp.product_id "
            + "LEFT JOIN first_stocked fs ON fs.product_id = fp.product_id "
            + "WHERE fp.facility_id = :facilityId AND fp.active", nativeQuery = true)
    List<CoverView> stockCover(@Param("facilityId") UUID facilityId, @Param("today") LocalDate today,
                               @Param("horizon") LocalDate horizon, @Param("usageFrom") Instant usageFrom,
                               @Param("usageTo") Instant usageTo);

    interface CoverView {
        UUID getProductId();

        String getCode();

        String getDisplayName();

        String getBaseUnit();

        long getAvailable();

        long getUsed();

        // Seconds since the epoch, or null for a product never stocked here.
        Long getFirstStockedEpoch();
    }

    @Query(value = "SELECT COUNT(*) AS \"count\", "
            + "CAST(FLOOR(EXTRACT(EPOCH FROM MIN(created_at))) AS BIGINT) AS \"oldestSinceEpoch\" "
            + "FROM prescriptions WHERE facility_id = :facilityId AND status IN ('PENDING', 'PARTIALLY_DISPENSED')",
            nativeQuery = true)
    WaitingView waiting(@Param("facilityId") UUID facilityId);

    interface WaitingView {
        long getCount();

        Long getOldestSinceEpoch();
    }

    // Lots still holding stock that expire from today up to :until, earliest
    // first, capped at :limit; totalItems is the uncapped count.
    @Query(value = PharmacyStockWorklistRepository.FACILITY_STOCK_CTE
            + "SELECT p.display_name AS \"productName\", fs.lot_number AS \"lotNumber\", "
            + "CAST(fs.expiry_date AS VARCHAR) AS \"expiryDate\", CAST(fs.quantity AS BIGINT) AS \"quantity\", "
            + "p.base_unit AS \"baseUnit\", COUNT(*) OVER () AS \"totalItems\" "
            + "FROM facility_stock fs JOIN pharmacy_products p ON p.id = fs.product_id "
            + "WHERE fs.quantity > 0 AND fs.expiry_date BETWEEN :today AND :until "
            + "ORDER BY fs.expiry_date, LOWER(p.display_name), fs.batch_id LIMIT :limit", nativeQuery = true)
    List<ExpiringLotView> expiringLots(@Param("facilityId") UUID facilityId, @Param("today") LocalDate today,
                                        @Param("horizon") LocalDate horizon, @Param("until") LocalDate until,
                                        @Param("limit") int limit);

    interface ExpiringLotView {
        String getProductName();

        String getLotNumber();

        String getExpiryDate();

        long getQuantity();

        String getBaseUnit();

        long getTotalItems();
    }

    // Per calendar month: lots expiring on or before :horizon (the 90-day
    // line) and those after it, so a month the line cuts through is split
    // honestly instead of being coloured all one way.
    @Query(value = PharmacyStockWorklistRepository.FACILITY_STOCK_CTE
            + "SELECT to_char(fs.expiry_date, 'YYYY-MM') AS \"month\", "
            + "COUNT(*) FILTER (WHERE fs.expiry_date <= :horizon) AS \"withinCount\", "
            + "COUNT(*) FILTER (WHERE fs.expiry_date > :horizon) AS \"laterCount\" "
            + "FROM facility_stock fs WHERE fs.quantity > 0 AND fs.expiry_date BETWEEN :today AND :until "
            + "GROUP BY to_char(fs.expiry_date, 'YYYY-MM')", nativeQuery = true)
    List<ExpiryMonthView> expiryByMonth(@Param("facilityId") UUID facilityId, @Param("today") LocalDate today,
                                         @Param("horizon") LocalDate horizon, @Param("until") LocalDate until);

    interface ExpiryMonthView {
        String getMonth();

        long getWithinCount();

        long getLaterCount();
    }

    @Query(value = PharmacyStockWorklistRepository.FACILITY_STOCK_CTE
            + "SELECT COUNT(*) FROM facility_stock WHERE quantity > 0 AND expiry_date < :today", nativeQuery = true)
    long expiredLotCount(@Param("facilityId") UUID facilityId, @Param("today") LocalDate today,
                         @Param("horizon") LocalDate horizon);

    // Prescriptions written for the facility, by its local calendar day.
    @Query(value = "SELECT CAST(CAST(created_at AT TIME ZONE CAST(:zone AS TEXT) AS DATE) AS VARCHAR) AS \"day\", "
            + "COUNT(*) AS \"count\" FROM prescriptions "
            + "WHERE facility_id = :facilityId AND created_at >= :from AND created_at < :to "
            + "GROUP BY 1", nativeQuery = true)
    List<DayCountView> receivedPerDay(@Param("facilityId") UUID facilityId, @Param("zone") String zone,
                                      @Param("from") Instant from, @Param("to") Instant to);

    // Distinct prescriptions that had medicine handed over that local day. A
    // prescription filled across two days counts on both: each was a visit
    // to the counter.
    @Query(value = "SELECT CAST(CAST(created_at AT TIME ZONE CAST(:zone AS TEXT) AS DATE) AS VARCHAR) AS \"day\", "
            + "COUNT(DISTINCT prescription_serial) AS \"count\" FROM pharmacy_stock_transactions "
            + "WHERE facility_id = :facilityId AND type = 'DISPENSE' AND prescription_serial IS NOT NULL "
            + "AND created_at >= :from AND created_at < :to "
            + "GROUP BY 1", nativeQuery = true)
    List<DayCountView> dispensedPerDay(@Param("facilityId") UUID facilityId, @Param("zone") String zone,
                                       @Param("from") Instant from, @Param("to") Instant to);

    interface DayCountView {
        String getDay();

        long getCount();
    }
}
