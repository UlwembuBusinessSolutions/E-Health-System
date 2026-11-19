package co.ehealth.platform.art;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ArtInitiationMedicalHistoryRepository extends JpaRepository<ArtInitiationMedicalHistory, UUID> {
    Optional<ArtInitiationMedicalHistory> findByVisitId(UUID visitId);
}
