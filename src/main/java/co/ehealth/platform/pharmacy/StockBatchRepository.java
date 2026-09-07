package co.ehealth.platform.pharmacy;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface StockBatchRepository extends JpaRepository<StockBatch, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from StockBatch b where b.barcode = :barcode")
    java.util.Optional<StockBatch> findByBarcodeForUpdate(@Param("barcode") String barcode);

    List<StockBatch> findByFacilityIdAndExpiryDateBetweenAndQuantityOnHandGreaterThan(
            UUID facilityId, LocalDate from, LocalDate through, int quantity);
}
