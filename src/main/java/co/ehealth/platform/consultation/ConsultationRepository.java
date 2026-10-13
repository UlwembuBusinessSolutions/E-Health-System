package co.ehealth.platform.consultation;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
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

    // A clinician's unsigned consultations, the one saved most recently first.
    List<Consultation> findByStatusAndAuthorUserIdOrderByUpdatedAtDesc(ConsultationStatus status, UUID authorUserId,
                                                                       Pageable page);

    // Every consultation of a patient across all their visits, newest first.
    @Query("select c from Consultation c where c.status in :statuses "
            + "and c.visitId in (select v.id from Visit v where v.patientId = :patientId) order by c.createdAt desc")
    List<Consultation> findForPatient(@Param("patientId") UUID patientId,
                                      @Param("statuses") Collection<ConsultationStatus> statuses, Pageable page);
}
