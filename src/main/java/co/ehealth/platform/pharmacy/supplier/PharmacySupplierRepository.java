package co.ehealth.platform.pharmacy.supplier;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface PharmacySupplierRepository extends JpaRepository<PharmacySupplier, UUID> {

    // Same '' sentinel as PharmacyProductRepository.search(): an untyped
    // null inside LOWER(CONCAT(...)) fails PostgreSQL's type inference.
    // Merged-away suppliers are hidden from the default list — their
    // receipts now live under the supplier they were merged into.
    @Query("SELECT s FROM PharmacySupplier s WHERE "
            + "(:search = '' OR LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%'))) "
            + "AND (:status IS NULL OR s.status = :status) "
            + "AND (:includeMerged = true OR s.mergedIntoId IS NULL) "
            + "ORDER BY s.name ASC")
    Page<PharmacySupplier> search(@Param("search") String search, @Param("status") SupplierStatus status,
                                  @Param("includeMerged") boolean includeMerged, Pageable pageable);
}
