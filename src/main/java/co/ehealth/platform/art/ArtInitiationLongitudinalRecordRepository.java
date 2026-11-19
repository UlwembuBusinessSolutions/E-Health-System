package co.ehealth.platform.art;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ArtInitiationLongitudinalRecordRepository
        extends JpaRepository<ArtInitiationLongitudinalRecord, UUID> {
    List<ArtInitiationLongitudinalRecord> findByVisitIdOrderByRecordDateDescSignedAtDesc(UUID visitId);
}
