package co.ehealth.platform.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PrescriptionOutOfStockRecordRepository extends JpaRepository<PrescriptionOutOfStockRecord, UUID> {

    // At most one row per item, upserted in place on re-marking (this
    // entity's own why-note), unlike DispensingRecordRepository's
    // insert-only rows.
    Optional<PrescriptionOutOfStockRecord> findByPrescriptionItemId(UUID prescriptionItemId);

    // The "who marked this out of stock, when, and why" detail for a whole
    // page of items at once (PrescriptionViewAssembler).
    List<PrescriptionOutOfStockRecord> findByPrescriptionItemIdIn(Collection<UUID> prescriptionItemIds);
}
