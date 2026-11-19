package co.ehealth.platform.art;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ArtInitiationPriorHaartHistoryRepository extends JpaRepository<ArtInitiationPriorHaartHistory, UUID> {
    Optional<ArtInitiationPriorHaartHistory> findByVisitId(UUID visitId);
}
