package co.ehealth.platform.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface PrescriptionRepository extends JpaRepository<Prescription, UUID> {

    // PrescriptionService.nextSerialNumber() — a real Postgres sequence,
    // same concurrency-safety reasoning as PatientRepository.nextMpiSequenceValue().
    @Query(value = "SELECT nextval('prescription_serial_seq')", nativeQuery = true)
    long nextSerialSequenceValue();

    // PHRM-US-001's dispensing queue — "ordered by triage priority then
    // time issued." No TriageAssessment/TEWS score exists yet
    // (RECQ-US-010, Sprint 3), so this orders by issue time alone; revisit
    // once a real priority signal exists to sort by first.
    List<Prescription> findByFacilityIdAndStatusOrderByCreatedAtAsc(UUID facilityId, PrescriptionStatus status);

    List<Prescription> findAllByOrderByCreatedAtDesc();
}
