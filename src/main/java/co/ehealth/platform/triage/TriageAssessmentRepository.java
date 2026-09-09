package co.ehealth.platform.triage;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TriageAssessmentRepository extends JpaRepository<TriageAssessment, UUID> {
    @org.springframework.data.jpa.repository.Query(value = "select t.* from triage_assessments t join visits v on v.id = t.visit_id "
            + "where v.facility_id = :clinicId order by t.captured_at desc, t.id desc", nativeQuery = true)
    java.util.List<TriageAssessment> findAllInClinic(@org.springframework.data.repository.query.Param("clinicId") UUID clinicId);

    @org.springframework.data.jpa.repository.Query(value = "select t.* from triage_assessments t join visits v on v.id = t.visit_id "
            + "where t.id = :id and v.facility_id = :clinicId", nativeQuery = true)
    Optional<TriageAssessment> findInClinic(@org.springframework.data.repository.query.Param("id") UUID id,
            @org.springframework.data.repository.query.Param("clinicId") UUID clinicId);

    @org.springframework.data.jpa.repository.Query(value = "select t.* from triage_assessments t join visits v on v.id = t.visit_id "
            + "where t.patient_id = :patientId and v.facility_id = :clinicId and t.captured_at < :before "
            + "order by t.captured_at desc, t.id desc limit 1", nativeQuery = true)
    Optional<TriageAssessment> findPriorInClinic(@org.springframework.data.repository.query.Param("patientId") UUID patientId,
            @org.springframework.data.repository.query.Param("clinicId") UUID clinicId,
            @org.springframework.data.repository.query.Param("before") java.time.Instant before);

    @org.springframework.data.jpa.repository.Query(value = "select t.* from triage_assessments t "
            + "join visits v on v.id = t.visit_id where t.patient_id = :patientId and v.facility_id = :clinicId "
            + "order by t.captured_at desc limit 1", nativeQuery = true)
    Optional<TriageAssessment> findLatestInClinic(
            @org.springframework.data.repository.query.Param("patientId") UUID patientId,
            @org.springframework.data.repository.query.Param("clinicId") UUID clinicId);
}
