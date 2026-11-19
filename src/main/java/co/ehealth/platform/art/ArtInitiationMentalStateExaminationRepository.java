package co.ehealth.platform.art;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ArtInitiationMentalStateExaminationRepository extends JpaRepository<ArtInitiationMentalStateExamination, UUID> {
    Optional<ArtInitiationMentalStateExamination> findByVisitId(UUID visitId);
}
