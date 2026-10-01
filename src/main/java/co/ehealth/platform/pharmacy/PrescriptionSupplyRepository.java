package co.ehealth.platform.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface PrescriptionSupplyRepository extends JpaRepository<PrescriptionSupply, UUID> {
    // Deliberately no facility predicate: all clinics in the current tenant are included.
    List<PrescriptionSupply> findByPatientIdAndProductIdAndSupplyUntilGreaterThanEqualOrderByDispensedAtDesc(
            UUID patientId, UUID productId, LocalDate today);

    interface HistoricalSupply {
        UUID getPrescriptionItemId();
        UUID getFacilityId();
        java.time.Instant getDispensedAt();
        int getQuantity();
    }

    // Older dispensing summaries have no coverage date. Surface that uncertainty instead of inventing one.
    @org.springframework.data.jpa.repository.Query(value = """
            SELECT pi.id AS prescriptionItemId, p.facility_id AS facilityId,
                   d.dispensed_at AS dispensedAt, pi.dispensed_quantity AS quantity
            FROM dispensing_records d
            JOIN prescription_items pi ON pi.id = d.prescription_item_id
            JOIN prescriptions p ON p.id = pi.prescription_id
            WHERE p.patient_id = :patientId AND pi.dispensed_quantity > 0
              AND (pi.product_id = :productId OR (pi.product_id IS NULL AND lower(trim(pi.drug_name)) = lower(trim(:drugName))))
              AND NOT EXISTS (SELECT 1 FROM prescription_supplies s WHERE s.prescription_item_id = pi.id)
            ORDER BY d.dispensed_at DESC
            """, nativeQuery = true)
    List<HistoricalSupply> findHistoricalSupplies(@org.springframework.data.repository.query.Param("patientId") UUID patientId,
            @org.springframework.data.repository.query.Param("productId") UUID productId,
            @org.springframework.data.repository.query.Param("drugName") String drugName);
}
