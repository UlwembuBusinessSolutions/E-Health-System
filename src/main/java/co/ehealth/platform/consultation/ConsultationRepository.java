package co.ehealth.platform.consultation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConsultationRepository extends JpaRepository<Consultation, UUID> {

    // The full history for a visit, oldest first — ConsultationService.
    // getHistory() reads from this rather than a separate "current" query,
    // since DRAFT/SIGNED-vs-SUPERSEDED/ENTERED_IN_ERROR is a status filter
    // over the same rows, not a different table.
    List<Consultation> findByVisitIdOrderByCreatedAtAsc(UUID visitId);

    // ConsultationService.getCurrent()'s two lookups — the visible
    // consultation for a visit is its latest DRAFT if one exists, else its
    // latest SIGNED one, else none at all.
    Optional<Consultation> findFirstByVisitIdAndStatusOrderByCreatedAtDesc(UUID visitId, ConsultationStatus status);
}
