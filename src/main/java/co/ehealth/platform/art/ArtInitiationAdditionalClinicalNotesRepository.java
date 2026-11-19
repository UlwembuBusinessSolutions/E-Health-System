package co.ehealth.platform.art;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface ArtInitiationAdditionalClinicalNotesRepository extends JpaRepository<ArtInitiationAdditionalClinicalNotes, UUID> {
    Optional<ArtInitiationAdditionalClinicalNotes> findByVisitId(UUID visitId);
}
