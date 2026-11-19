package co.ehealth.platform.art;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface ArtStage1ConditionsRepository extends JpaRepository<ArtStage1Conditions, UUID> {
    Optional<ArtStage1Conditions> findByVisitId(UUID visitId);
}
