package co.ehealth.platform.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface PrescriptionItemRepository extends JpaRepository<PrescriptionItem, UUID> {
    List<PrescriptionItem> findByPrescriptionId(UUID prescriptionId);

    // One query for a whole page of prescriptions, instead of one per
    // prescription, when the queue/search views are assembled.
    List<PrescriptionItem> findByPrescriptionIdIn(Collection<UUID> prescriptionIds);

    // The "stock arrived" worklist's starting point: items the pharmacy
    // flagged out of stock, scoped to the facility their prescription
    // belongs to.
    @Query("SELECT i FROM PrescriptionItem i, Prescription p WHERE i.prescriptionId = p.id "
            + "AND p.facilityId = :facilityId AND i.status = :status ORDER BY p.createdAt ASC")
    List<PrescriptionItem> findByFacilityAndStatus(@Param("facilityId") UUID facilityId,
                                                    @Param("status") PrescriptionStatus status);
}
