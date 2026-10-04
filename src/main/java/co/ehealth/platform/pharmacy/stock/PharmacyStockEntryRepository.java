package co.ehealth.platform.pharmacy.stock;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface PharmacyStockEntryRepository extends JpaRepository<PharmacyStockEntry, UUID> {
    List<PharmacyStockEntry> findByTransactionId(UUID transactionId);

    List<PharmacyStockEntry> findByStockAccountIdOrderBySeqAsc(UUID stockAccountId);

    // Every ledger read starts from the same joins — an entry, the account it
    // moved, that account's location (to scope by facility), its transaction,
    // product and lot — so the filters below are plain WHERE clauses and the
    // database does the paging. String filters use '' and date filters use a
    // wide default range instead of NULL: an untyped NULL bind parameter makes
    // PostgreSQL infer bytea inside LOWER()/CONCAT() (see
    // PharmacyProductRepository.search()).
    String LEDGER_FROM = "FROM PharmacyStockEntry e, PharmacyStockAccount a, PharmacyStockLocation l, "
            + "PharmacyStockTransaction t, PharmacyProduct p, PharmacyBatch b "
            + "WHERE e.stockAccountId = a.id AND a.locationId = l.id AND l.facilityId = :facilityId "
            + "AND e.transactionId = t.id AND a.productId = p.id AND a.batchId = b.id "
            + "AND (:productId IS NULL OR a.productId = :productId) "
            + "AND (:type = '' OR CAST(t.type AS string) = :type) "
            + "AND (:supplierId IS NULL OR t.supplierId = :supplierId) "
            + "AND (:patientId IS NULL OR t.patientId = :patientId) "
            + "AND e.createdAt >= :from AND e.createdAt < :to "
            + "AND (:q = '' OR LOWER(p.displayName) LIKE CONCAT('%', :q, '%') "
            + "OR LOWER(p.code) LIKE CONCAT('%', :q, '%') "
            + "OR LOWER(b.lotNumber) LIKE CONCAT('%', :q, '%') "
            + "OR LOWER(t.actorName) LIKE CONCAT('%', :q, '%') "
            + "OR LOWER(COALESCE(t.prescriptionSerial, '')) LIKE CONCAT('%', :q, '%') "
            + "OR EXISTS (SELECT 1 FROM Patient pt WHERE pt.id = t.patientId "
            + "AND (LOWER(CONCAT(pt.firstName, ' ', pt.lastName)) LIKE CONCAT('%', :q, '%') "
            + "OR LOWER(pt.mpiNumber) LIKE CONCAT('%', :q, '%')))) ";

    // Newest first by seq — the authoritative server order, not createdAt
    // (PharmacyStockEntry's own why-note).
    @Query(value = "SELECT e " + LEDGER_FROM + "ORDER BY e.seq DESC",
            countQuery = "SELECT COUNT(e) " + LEDGER_FROM)
    Page<PharmacyStockEntry> findLedger(@Param("facilityId") UUID facilityId, @Param("productId") UUID productId,
                                         @Param("type") String type, @Param("supplierId") UUID supplierId,
                                         @Param("patientId") UUID patientId, @Param("q") String q,
                                         @Param("from") Instant from, @Param("to") Instant to, Pageable pageable);

    // A product's running balance after any entry is the sum of every delta
    // posted up to that entry's seq — the history view derives the whole page
    // from this one number instead of storing a per-product balance column.
    @Query("SELECT COALESCE(SUM(e.quantityDelta), 0) FROM PharmacyStockEntry e, PharmacyStockAccount a, "
            + "PharmacyStockLocation l WHERE e.stockAccountId = a.id AND a.locationId = l.id "
            + "AND l.facilityId = :facilityId AND a.productId = :productId AND e.seq <= :seq")
    long sumQuantityDeltaUpTo(@Param("facilityId") UUID facilityId, @Param("productId") UUID productId,
                               @Param("seq") long seq);

    // Which of these accounts saw a movement of the given types after the
    // given seq — a reversal is refused when stock it would take back has
    // since been dispensed or written off. One query for the whole
    // transaction; the caller passes the transaction's lowest entry seq, which
    // can only over-block by a movement that landed between its own entries.
    @Query("SELECT DISTINCT e.stockAccountId FROM PharmacyStockEntry e, PharmacyStockTransaction t "
            + "WHERE e.transactionId = t.id AND e.stockAccountId IN :accountIds AND e.seq > :seq "
            + "AND t.type IN :types")
    List<UUID> findAccountIdsWithMovementsAfter(@Param("accountIds") Collection<UUID> accountIds,
                                                 @Param("seq") long seq,
                                                 @Param("types") Collection<StockTransactionType> types);
}
