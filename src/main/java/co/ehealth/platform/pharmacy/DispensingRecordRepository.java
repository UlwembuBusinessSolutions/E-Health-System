package co.ehealth.platform.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface DispensingRecordRepository extends JpaRepository<DispensingRecord, UUID> {

    // PrescriptionService.getDispensingRecord() — the patient Medication
    // tab's "who dispensed this item, and when" detail. At most one row per
    // item (DispensingRecord's own why-note: an item is terminal once
    // dispensed).
    Optional<DispensingRecord> findByPrescriptionItemId(UUID prescriptionItemId);
}
