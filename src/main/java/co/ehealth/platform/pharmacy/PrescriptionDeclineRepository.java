package co.ehealth.platform.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface PrescriptionDeclineRepository extends JpaRepository<PrescriptionDecline, UUID> {
    Optional<PrescriptionDecline> findByPrescriptionIdAndFacilityId(UUID prescriptionId, UUID facilityId);
}
