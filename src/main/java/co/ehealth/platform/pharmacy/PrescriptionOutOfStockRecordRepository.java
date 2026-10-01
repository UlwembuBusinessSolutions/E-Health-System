package co.ehealth.platform.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PrescriptionOutOfStockRecordRepository extends JpaRepository<PrescriptionOutOfStockRecord, UUID> {

    // PrescriptionService.getOutOfStockRecord() — the patient Medication
    // tab's "who marked this item out of stock, when, and why" detail. At
    // most one row per item, upserted in place on re-marking (this entity's
    // own why-note), unlike DispensingRecordRepository's insert-only rows.
    Optional<PrescriptionOutOfStockRecord> findByPrescriptionItemId(UUID prescriptionItemId);
}
