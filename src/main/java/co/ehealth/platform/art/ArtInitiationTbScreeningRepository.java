package co.ehealth.platform.art;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ArtInitiationTbScreeningRepository extends JpaRepository<ArtInitiationTbScreening, UUID> {
    Optional<ArtInitiationTbScreening> findByVisitId(UUID visitId);
}
