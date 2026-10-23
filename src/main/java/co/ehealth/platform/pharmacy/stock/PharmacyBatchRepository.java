package co.ehealth.platform.pharmacy.stock;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PharmacyBatchRepository extends JpaRepository<PharmacyBatch, UUID> {

    // manufacturer is nullable (plan section 4: "Manufacturer: Optional"),
    // so this can't be a derived findByXxxAndManufacturerAndYyy — an
    // equality predicate against a null bind parameter never matches a
    // NULL column value in JPQL, which would silently fail to find an
    // existing untracked-manufacturer lot and create a duplicate batch
    // row instead of correctly detecting the conflict/match
    // PharmacyStockLedgerService relies on this for.
    @Query("SELECT b FROM PharmacyBatch b WHERE b.productId = :productId "
            + "AND ((:manufacturer IS NULL AND b.manufacturer IS NULL) OR b.manufacturer = :manufacturer) "
            + "AND b.lotNumber = :lotNumber")
    Optional<PharmacyBatch> findMatching(@Param("productId") UUID productId,
                                          @Param("manufacturer") String manufacturer,
                                          @Param("lotNumber") String lotNumber);

    List<PharmacyBatch> findByProductIdOrderByExpiryDateAsc(UUID productId);
}
