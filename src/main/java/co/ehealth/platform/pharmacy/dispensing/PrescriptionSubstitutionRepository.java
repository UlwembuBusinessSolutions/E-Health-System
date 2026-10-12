package co.ehealth.platform.pharmacy.dispensing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PrescriptionSubstitutionRepository extends JpaRepository<PrescriptionSubstitution, UUID> {

    // Newest first, so the first row per item is the current state of that
    // item's substitution conversation.
    List<PrescriptionSubstitution> findByPrescriptionItemIdInOrderByRequestedAtDesc(Collection<UUID> itemIds);

    Optional<PrescriptionSubstitution> findFirstByPrescriptionItemIdOrderByRequestedAtDesc(UUID itemId);
}
