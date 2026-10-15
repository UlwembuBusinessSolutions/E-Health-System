package co.ehealth.platform.pharmacy.stock;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface PharmacyStockEntryRepository extends JpaRepository<PharmacyStockEntry, UUID> {
    List<PharmacyStockEntry> findByTransactionId(UUID transactionId);

    List<PharmacyStockEntry> findByStockAccountIdOrderBySeqAsc(UUID stockAccountId);

    // The ledger view's read side — facility-scoped via the account's
    // location, product-filterable, newest first (seq is the authoritative
    // server order, not createdAt — PharmacyStockEntry's own why-note).
    @Query("SELECT e FROM PharmacyStockEntry e, PharmacyStockAccount a, PharmacyStockLocation l "
            + "WHERE e.stockAccountId = a.id AND a.locationId = l.id AND l.facilityId = :facilityId "
            + "AND (:productId IS NULL OR a.productId = :productId) "
            + "ORDER BY e.seq DESC")
    Page<PharmacyStockEntry> findLedger(@Param("facilityId") UUID facilityId, @Param("productId") UUID productId,
                                         Pageable pageable);
}
