package co.ehealth.platform.art;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface ArtInitiationHealthEducationRepository extends JpaRepository<ArtInitiationHealthEducation, UUID> {
    Optional<ArtInitiationHealthEducation> findByVisitId(UUID visitId);
}
