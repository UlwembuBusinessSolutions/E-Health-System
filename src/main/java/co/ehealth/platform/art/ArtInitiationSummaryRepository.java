package co.ehealth.platform.art;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ArtInitiationSummaryRepository extends JpaRepository<ArtInitiationSummary, UUID> {

    Optional<ArtInitiationSummary> findByVisitId(UUID visitId);
}
