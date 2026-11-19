package co.ehealth.platform.art;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ArtInitiationSkinExaminationRepository extends JpaRepository<ArtInitiationSkinExamination, UUID> {
    Optional<ArtInitiationSkinExamination> findByVisitId(UUID visitId);
}
