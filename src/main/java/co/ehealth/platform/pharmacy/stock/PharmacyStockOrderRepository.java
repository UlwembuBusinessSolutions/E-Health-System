package co.ehealth.platform.pharmacy.stock;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PharmacyStockOrderRepository extends JpaRepository<PharmacyStockOrder, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from PharmacyStockOrder o where o.id = :id")
    Optional<PharmacyStockOrder> findByIdForUpdate(@Param("id") UUID id);

    List<PharmacyStockOrder> findTop50ByFacilityIdOrderByCreatedAtDesc(UUID facilityId);
}