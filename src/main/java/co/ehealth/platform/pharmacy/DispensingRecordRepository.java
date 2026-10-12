package co.ehealth.platform.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface DispensingRecordRepository extends JpaRepository<DispensingRecord, UUID> {

    // The "who dispensed this item, and when" detail for a whole page of
    // items at once (PrescriptionViewAssembler). At most one row per item
    // (DispensingRecord's own why-note: an item is terminal once dispensed).
    List<DispensingRecord> findByPrescriptionItemIdIn(Collection<UUID> prescriptionItemIds);
}
