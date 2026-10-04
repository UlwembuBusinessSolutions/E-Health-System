package co.ehealth.platform.pharmacy.dispensing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PrescriptionCollectionRepository extends JpaRepository<PrescriptionCollection, UUID> {

    // A prescription can be collected in several visits; the details screen
    // shows the most recent hand-over.
    Optional<PrescriptionCollection> findFirstByPrescriptionIdOrderByHandedOverAtDesc(UUID prescriptionId);
}
