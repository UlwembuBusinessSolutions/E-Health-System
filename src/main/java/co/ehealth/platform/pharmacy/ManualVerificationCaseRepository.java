package co.ehealth.platform.pharmacy;

// lihle | 2026-09-09 | Scoped prescription and verification queries to the active clinic to protect patient records.

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ManualVerificationCaseRepository extends JpaRepository<ManualVerificationCase, UUID> {
    Optional<ManualVerificationCase> findByPrescriptionId(UUID prescriptionId);
    @org.springframework.data.jpa.repository.Query("select c from ManualVerificationCase c "
            + "where c.prescriptionId in (select p.id from Prescription p where p.facilityId = :clinicId) "
            + "order by c.createdAt")
    List<ManualVerificationCase> findInClinic(@org.springframework.data.repository.query.Param("clinicId") UUID clinicId);
}
