package co.ehealth.platform.art;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface ArtInitiationReferralConfirmationRepository extends JpaRepository<ArtInitiationReferralConfirmation, UUID> {
    Optional<ArtInitiationReferralConfirmation> findByVisitId(UUID visitId);
}
