package co.ehealth.platform.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PrescriptionRepository extends JpaRepository<Prescription, UUID> {

    // PrescriptionService.nextSerialNumber() — a real Postgres sequence,
    // same concurrency-safety reasoning as PatientRepository.nextMpiSequenceValue().
    @Query(value = "SELECT nextval('prescription_serial_seq')", nativeQuery = true)
    long nextSerialSequenceValue();

    // PHRM-US-001's dispensing queue — "ordered by triage priority then
    // time issued." No TriageAssessment/TEWS score exists yet
    // (RECQ-US-010, Sprint 3), so this orders by issue time alone; revisit
    // once a real priority signal exists to sort by first. PARTIALLY_DISPENSED
    // keeps a prescription visible here as long as any of its own items is
    // still PENDING — OUT_OF_STOCK alone (nothing left pending) drops it,
    // findable again only via findBySerialNumber().
    List<Prescription> findByFacilityIdAndStatusInOrderByCreatedAtAsc(UUID facilityId,
                                                                        List<PrescriptionStatus> statuses);

    // The patient-level Medication tab (PatientDetailPage) — every
    // prescription across every visit this patient has ever had, newest
    // first, every status alike.
    List<Prescription> findByPatientIdOrderByCreatedAtDesc(UUID patientId);

    // The pharmacy "look up a prescription" utility — finds one regardless
    // of status, specifically so a prescription that dropped off the queue
    // (fully out of stock, nothing pending) can still be located once
    // stock is back. Serial numbers are unique (V10__pharmacy.sql).
    Optional<Prescription> findBySerialNumber(String serialNumber);
}
