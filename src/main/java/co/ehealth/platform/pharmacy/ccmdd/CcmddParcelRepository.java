package co.ehealth.platform.pharmacy.ccmdd;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Query;
import java.time.Instant;
import java.util.*;

public interface CcmddParcelRepository extends JpaRepository<CcmddParcel, UUID> {
    List<CcmddParcel> findByFacilityIdOrderByDispatchedAtDesc(UUID facilityId);
    List<CcmddParcel> findByFacilityIdAndStatusInAndTraceDueAtLessThanEqualOrderByTraceDueAtAsc(
            UUID facilityId, List<String> statuses, Instant now);
    boolean existsByPrescriptionId(UUID prescriptionId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM CcmddParcel p WHERE p.id = :id")
    Optional<CcmddParcel> findLockedById(UUID id);
}
