package co.ehealth.platform.art;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ArtInitiationMusculoskeletalRepository extends JpaRepository<ArtInitiationMusculoskeletal, UUID> {
    Optional<ArtInitiationMusculoskeletal> findByVisitId(UUID visitId);
}
