package co.ehealth.platform.pharmacy.count;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PharmacyStockCountRepository extends JpaRepository<PharmacyStockCount, UUID> {

    List<PharmacyStockCount> findByFacilityIdOrderByStartedAtDesc(UUID facilityId);

    List<PharmacyStockCount> findByFacilityIdAndStatusOrderByStartedAtDesc(UUID facilityId, CountStatus status);

    // Posting takes this lock so two simultaneous "post" clicks queue up:
    // the second one then sees POSTED and returns without posting again.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM PharmacyStockCount c WHERE c.id = :id")
    Optional<PharmacyStockCount> findByIdForUpdate(@Param("id") UUID id);

    @Query(value = "SELECT nextval('pharmacy_count_reference_seq')", nativeQuery = true)
    long nextReferenceSequenceValue();
}
