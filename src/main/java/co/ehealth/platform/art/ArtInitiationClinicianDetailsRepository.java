package co.ehealth.platform.art;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface ArtInitiationClinicianDetailsRepository extends JpaRepository<ArtInitiationClinicianDetails, UUID> {
    Optional<ArtInitiationClinicianDetails> findByVisitId(UUID visitId);
}
