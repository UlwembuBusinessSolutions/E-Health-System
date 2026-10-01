package co.ehealth.platform.triage;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TriageAssessmentRepository extends JpaRepository<TriageAssessment, UUID> {

    // The full history for a visit, oldest first — TriageService.getHistory()
    // and the "latest valid" lookup both read from this rather than a
    // separate "current" query, since ACTIVE-vs-SUPERSEDED/ENTERED_IN_ERROR
    // is a status filter over the same rows, not a different table.
    List<TriageAssessment> findByVisitIdOrderByObservedAtAsc(UUID visitId);

    // TriageService's idempotency check — a retry (double-click, network
    // retry) with the same key against the same visit returns the row that
    // already exists instead of inserting a duplicate.
    Optional<TriageAssessment> findByVisitIdAndIdempotencyKey(UUID visitId, String idempotencyKey);

    // The patient-level Vitals tab's own history — every capture across
    // every visit a patient has had (TriageService.getPatientVitalsHistory()
    // resolves the visit ids via VisitRepository.findByPatientId() first,
    // same "no cross-package JPQL join, just an injected repository" pattern
    // this service already uses for Visit lookups elsewhere). Newest first,
    // unlike findByVisitIdOrderByObservedAtAsc above: a single visit's own
    // history reads naturally as a timeline since check-in, but a patient's
    // whole history is read the way most EHR vitals lists are — most recent
    // reading on top.
    List<TriageAssessment> findByVisitIdInOrderByObservedAtDesc(List<UUID> visitIds);

    @Query("SELECT ta FROM TriageAssessment ta WHERE ta.visitId = :visitId AND ta.status = 'ACTIVE' "
            + "ORDER BY ta.observedAt DESC")
    List<TriageAssessment> findActiveOrderByObservedAtDesc(@Param("visitId") UUID visitId);
}
