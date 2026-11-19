package co.ehealth.platform.art;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ArtInitiationCentralNervousSystemRepository extends JpaRepository<ArtInitiationCentralNervousSystem, UUID> {
    Optional<ArtInitiationCentralNervousSystem> findByVisitId(UUID visitId);
}
