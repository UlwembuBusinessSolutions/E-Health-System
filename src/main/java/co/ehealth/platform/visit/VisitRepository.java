package co.ehealth.platform.visit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface VisitRepository extends JpaRepository<Visit, UUID> {

    // TriageService.getPatientVitalsHistory() — every visit this patient has
    // ever had, across every facility, so that method can pull the vitals
    // captured against each one. Order doesn't matter here; only the ids
    // are used, and the assessments themselves get their own ordering.
    List<Visit> findByPatientId(UUID patientId);

    // VisitService.getPatientVisitHistory() — the patient record's own
    // Visits tab, newest first (same convention TriageService's patient-wide
    // vitals list already reads most-recent-first).
    List<Visit> findByPatientIdOrderByVisitDateTimeDesc(UUID patientId);
}
