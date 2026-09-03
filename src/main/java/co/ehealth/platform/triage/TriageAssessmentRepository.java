package co.ehealth.platform.triage;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TriageAssessmentRepository extends JpaRepository<TriageAssessment, UUID> {
    Optional<TriageAssessment> findFirstByPatientIdOrderByCapturedAtDesc(UUID patientId);
}
