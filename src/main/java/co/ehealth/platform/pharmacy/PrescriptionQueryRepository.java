package co.ehealth.platform.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface PrescriptionQueryRepository extends JpaRepository<PrescriptionQuery, UUID> {
    Optional<PrescriptionQuery> findByIdAndFacilityId(UUID id, UUID facilityId);
    Optional<PrescriptionQuery> findFirstByPrescriptionIdAndStatusOrderByRaisedAtDesc(UUID prescriptionId, PrescriptionQueryStatus status);
    List<PrescriptionQuery> findByFacilityIdOrderByRaisedAtDesc(UUID facilityId);
}
