package co.ehealth.platform.pharmacy.dispensing;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface DispenseAllocationRepository extends JpaRepository<DispenseAllocation, UUID> {

    List<DispenseAllocation> findByPrescriptionItemIdOrderByCreatedAtAsc(UUID prescriptionItemId);

    // Every lot ever dispensed to this patient, newest first — the
    // patient-linked dispensing history. Capped by the caller's Pageable.
    @Query("SELECT a FROM DispenseAllocation a, co.ehealth.platform.pharmacy.PrescriptionItem i, "
            + "co.ehealth.platform.pharmacy.Prescription p WHERE a.prescriptionItemId = i.id "
            + "AND i.prescriptionId = p.id AND p.patientId = :patientId ORDER BY a.createdAt DESC")
    List<DispenseAllocation> findForPatient(@Param("patientId") UUID patientId, Pageable pageable);
}
