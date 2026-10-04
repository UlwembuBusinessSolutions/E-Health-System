package co.ehealth.platform.pharmacy.stock;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface PharmacyReceiptRepository extends JpaRepository<PharmacyReceipt, UUID> {
    // Idempotent-retry lookup — PharmacyReceiptService.receive()'s own
    // why-note: when postEntries() returns an already-posted transaction
    // (same idempotency key replayed), this is how the retry finds the
    // original receipt instead of creating a second one.
    Optional<PharmacyReceipt> findByTransactionId(UUID transactionId);

    // Reversal takes this lock first so two people pressing "Reverse" on the
    // same receipt serialise: the second one then sees REVERSED and stops.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM PharmacyReceipt r WHERE r.id = :id")
    Optional<PharmacyReceipt> findByIdForUpdate(@Param("id") UUID id);

    @Query(value = "SELECT nextval('pharmacy_receipt_number_seq')", nativeQuery = true)
    long nextReceiptNumberValue();

    // facilityId/supplierId use the IS NULL idiom proven by findLedger();
    // the text filter uses the '' sentinel and the date range uses real
    // bounds (PharmacyProductRepository.search()'s why-note on untyped nulls).
    @Query("SELECT r FROM PharmacyReceipt r WHERE (:facilityId IS NULL OR r.facilityId = :facilityId) "
            + "AND (:supplierId IS NULL OR r.supplierId = :supplierId) "
            + "AND r.createdAt >= :fromInclusive AND r.createdAt < :toExclusive "
            + "AND (:search = '' OR LOWER(r.receiptNumber) LIKE LOWER(CONCAT('%', :search, '%')) "
            + "OR LOWER(COALESCE(r.invoiceNumber, '')) LIKE LOWER(CONCAT('%', :search, '%')) "
            + "OR LOWER(COALESCE(r.supplierName, '')) LIKE LOWER(CONCAT('%', :search, '%')) "
            + "OR LOWER(COALESCE(r.sourceReference, '')) LIKE LOWER(CONCAT('%', :search, '%'))) "
            + "ORDER BY r.createdAt DESC")
    Page<PharmacyReceipt> search(@Param("facilityId") UUID facilityId, @Param("supplierId") UUID supplierId,
                                 @Param("search") String search, @Param("fromInclusive") Instant fromInclusive,
                                 @Param("toExclusive") Instant toExclusive, Pageable pageable);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE PharmacyReceipt r SET r.supplierId = :targetId WHERE r.supplierId = :sourceId")
    void repointSupplier(@Param("sourceId") UUID sourceId, @Param("targetId") UUID targetId);
}
