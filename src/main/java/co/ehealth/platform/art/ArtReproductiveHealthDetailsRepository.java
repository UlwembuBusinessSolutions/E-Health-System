package co.ehealth.platform.art;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ArtReproductiveHealthDetailsRepository extends JpaRepository<ArtReproductiveHealthDetails, UUID> {
    Optional<ArtReproductiveHealthDetails> findByVisitId(UUID visitId);
}
