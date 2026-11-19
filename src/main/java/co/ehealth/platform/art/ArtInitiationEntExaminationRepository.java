package co.ehealth.platform.art;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface ArtInitiationEntExaminationRepository extends JpaRepository<ArtInitiationEntExamination, UUID> {
    Optional<ArtInitiationEntExamination> findByVisitId(UUID visitId);
}
