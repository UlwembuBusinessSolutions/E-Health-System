package co.ehealth.platform.pharmacy.stock;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

// The set-based reads behind the Stock page, its dashboard cards and the
// expiry worklist. Native SQL because each one aggregates balances across
// accounts and lots and must page in the database; the shared CTE below is
// the one definition of "what a facility holds right now".
//
// Conventions shared by every query here:
//  - String filters use '' for "no filter" (an untyped NULL parameter makes
//    PostgreSQL infer bytea inside LOWER()/CONCAT()).
//  - Dates come back as ISO text: a native query's DATE column has no stable
//    Java type across Hibernate versions, text always parses.
//  - Aliases are quoted so the camelCase projection getters match them.
//  - Paged queries carry the grand total on every row (COUNT(*) OVER ()),
//    which saves a second count query that would repeat the whole filter.
public interface PharmacyStockWorklistRepository extends Repository<PharmacyStockAccount, UUID> {

    // facility_stock: one row per AVAILABLE account at the facility with its
    // lot's number and expiry. balances: that rolled up per product, with the
    // expiring-lot count for the status filter. Phase 1 has a single MAIN
    // location per facility, so an account is a lot.
    String FACILITY_STOCK_CTE = "WITH facility_stock AS ("
            + "SELECT a.product_id AS product_id, a.batch_id AS batch_id, a.quantity AS quantity, "
            + "b.lot_number AS lot_number, b.expiry_date AS expiry_date "
            + "FROM pharmacy_stock_accounts a "
            + "JOIN pharmacy_stock_locations l ON l.id = a.location_id AND l.facility_id = :facilityId "
            + "JOIN pharmacy_batches b ON b.id = a.batch_id "
            + "WHERE a.bucket = 'AVAILABLE'), "
            + "balances AS ("
            + "SELECT product_id, SUM(quantity) AS available, "
            + "COUNT(*) FILTER (WHERE quantity > 0) AS lot_count, "
            + "MIN(expiry_date) FILTER (WHERE quantity > 0) AS next_expiry, "
            + "COUNT(*) FILTER (WHERE quantity > 0 AND expiry_date BETWEEN :today AND :horizon) AS expiring_lots "
            + "FROM facility_stock GROUP BY product_id) ";

    // Rows are the facility's active assortment plus anything still holding
    // stock (e.g. an archived product with units left), so out-of-stock
    // products are listed and can be filtered.
    @Query(value = FACILITY_STOCK_CTE
            + "SELECT p.id AS \"productId\", p.code AS \"code\", p.display_name AS \"displayName\", "
            + "p.base_unit AS \"baseUnit\", CAST(COALESCE(bal.available, 0) AS BIGINT) AS \"available\", "
            + "fp.reorder_threshold AS \"reorderThreshold\", CAST(bal.next_expiry AS VARCHAR) AS \"nextExpiry\", "
            + "COALESCE(bal.lot_count, 0) AS \"lotCount\", NOT p.active AS \"archived\", "
            + "COUNT(*) OVER () AS \"totalItems\" "
            + "FROM pharmacy_products p "
            + "LEFT JOIN pharmacy_facility_products fp ON fp.product_id = p.id AND fp.facility_id = :facilityId "
            + "AND fp.active "
            + "LEFT JOIN balances bal ON bal.product_id = p.id "
            + "WHERE (fp.id IS NOT NULL OR COALESCE(bal.available, 0) > 0) "
            + "AND (:q = '' OR LOWER(p.display_name) LIKE CONCAT('%', :q, '%') "
            + "OR LOWER(p.code) LIKE CONCAT('%', :q, '%') "
            + "OR LOWER(COALESCE(p.generic_name, '')) LIKE CONCAT('%', :q, '%') "
            + "OR LOWER(COALESCE(p.barcode, '')) LIKE CONCAT('%', :q, '%')) "
            + "AND (:status = '' "
            + "OR (:status = 'OUT' AND p.active AND COALESCE(bal.available, 0) = 0) "
            + "OR (:status = 'LOW' AND p.active AND COALESCE(bal.available, 0) > 0 "
            + "AND fp.reorder_threshold IS NOT NULL AND bal.available <= fp.reorder_threshold) "
            + "OR (:status = 'EXPIRING' AND COALESCE(bal.expiring_lots, 0) > 0)) "
            + "ORDER BY LOWER(p.display_name), p.id LIMIT :limit OFFSET :offset", nativeQuery = true)
    List<StockRowView> listStock(@Param("facilityId") UUID facilityId, @Param("q") String q,
                                  @Param("status") String status, @Param("today") LocalDate today,
                                  @Param("horizon") LocalDate horizon, @Param("limit") int limit,
                                  @Param("offset") int offset);

    interface StockRowView {
        UUID getProductId();

        String getCode();

        String getDisplayName();

        String getBaseUnit();

        long getAvailable();

        Integer getReorderThreshold();

        String getNextExpiry();

        long getLotCount();

        boolean getArchived();

        long getTotalItems();
    }

    // Low/out count active assortment products only (plan section 5: products
    // never stocked here, or archived, never raise shortage alerts); expiring
    // and expired count lots still holding stock, matching the expiry list.
    @Query(value = FACILITY_STOCK_CTE
            + "SELECT shortage.low_count AS \"lowCount\", shortage.out_count AS \"outCount\", "
            + "expiry.expiring_count AS \"expiringCount\", expiry.expired_count AS \"expiredCount\", "
            + "queue.awaiting_count AS \"awaitingCollectionCount\" "
            + "FROM (SELECT "
            + "COUNT(*) FILTER (WHERE COALESCE(bal.available, 0) > 0 AND fp.reorder_threshold IS NOT NULL "
            + "AND bal.available <= fp.reorder_threshold) AS low_count, "
            + "COUNT(*) FILTER (WHERE COALESCE(bal.available, 0) = 0) AS out_count "
            + "FROM pharmacy_facility_products fp "
            + "JOIN pharmacy_products p ON p.id = fp.product_id AND p.active "
            + "LEFT JOIN balances bal ON bal.product_id = fp.product_id "
            + "WHERE fp.facility_id = :facilityId AND fp.active) shortage "
            + "CROSS JOIN (SELECT "
            + "COUNT(*) FILTER (WHERE expiry_date BETWEEN :today AND :horizon) AS expiring_count, "
            + "COUNT(*) FILTER (WHERE expiry_date < :today) AS expired_count "
            + "FROM facility_stock WHERE quantity > 0 AND expiry_date IS NOT NULL) expiry "
            + "CROSS JOIN (SELECT COUNT(*) AS awaiting_count FROM prescriptions "
            + "WHERE facility_id = :facilityId AND status IN ('PENDING', 'PARTIALLY_DISPENSED')) queue",
            nativeQuery = true)
    DashboardCountsView dashboardCounts(@Param("facilityId") UUID facilityId, @Param("today") LocalDate today,
                                         @Param("horizon") LocalDate horizon);

    interface DashboardCountsView {
        long getLowCount();

        long getOutCount();

        long getExpiringCount();

        long getExpiredCount();

        long getAwaitingCollectionCount();
    }

    // Lots with stock that expire on or before the horizon — already-expired
    // ones included, earliest first so the most urgent lead the list.
    @Query(value = FACILITY_STOCK_CTE
            + "SELECT p.id AS \"productId\", p.display_name AS \"productName\", p.code AS \"productCode\", "
            + "fs.batch_id AS \"batchId\", fs.lot_number AS \"lotNumber\", "
            + "CAST(fs.expiry_date AS VARCHAR) AS \"expiryDate\", CAST(fs.quantity AS BIGINT) AS \"quantity\", "
            + "COUNT(*) OVER () AS \"totalItems\" "
            + "FROM facility_stock fs JOIN pharmacy_products p ON p.id = fs.product_id "
            + "WHERE fs.quantity > 0 AND fs.expiry_date IS NOT NULL AND fs.expiry_date <= :horizon "
            + "ORDER BY fs.expiry_date, LOWER(p.display_name), fs.batch_id LIMIT :limit OFFSET :offset",
            nativeQuery = true)
    List<ExpiryLotView> listExpiringLots(@Param("facilityId") UUID facilityId, @Param("today") LocalDate today,
                                          @Param("horizon") LocalDate horizon, @Param("limit") int limit,
                                          @Param("offset") int offset);

    interface ExpiryLotView {
        UUID getProductId();

        String getProductName();

        String getProductCode();

        UUID getBatchId();

        String getLotNumber();

        String getExpiryDate();

        long getQuantity();

        long getTotalItems();
    }
}
