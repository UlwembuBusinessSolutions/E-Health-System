package co.ehealth.platform.art;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ArtInitiationJaccolExaminationRepository extends JpaRepository<ArtInitiationJaccolExamination, UUID> {
    Optional<ArtInitiationJaccolExamination> findByVisitId(UUID visitId);
}
