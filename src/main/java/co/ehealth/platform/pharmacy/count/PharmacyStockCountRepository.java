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

    // The latest posted time per area label, in one grouped query.
    @Query("SELECT new co.ehealth.platform.pharmacy.count.AreaLastCounted(c.scopeLabel, MAX(c.postedAt)) "
            + "FROM PharmacyStockCount c WHERE c.facilityId = :facilityId "
            + "AND c.status = co.ehealth.platform.pharmacy.count.CountStatus.POSTED "
            + "AND c.scope = co.ehealth.platform.pharmacy.count.CountScope.AREA GROUP BY c.scopeLabel")
    List<AreaLastCounted> latestPostedAreaCounts(@Param("facilityId") UUID facilityId);

    // Posting takes this lock so two simultaneous "post" clicks queue up:
    // the second one then sees POSTED and returns without posting again.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM PharmacyStockCount c WHERE c.id = :id")
    Optional<PharmacyStockCount> findByIdForUpdate(@Param("id") UUID id);

    @Query(value = "SELECT nextval('pharmacy_count_reference_seq')", nativeQuery = true)
    long nextReferenceSequenceValue();
}
