package co.ehealth.platform.pharmacy.register;

import java.util.Optional;
import java.util.UUID;

// The register only needs to know whether a product is a scheduled
// medicine, and which schedule. The product's `schedule` column belongs to
// the product catalog, so the catalog side supplies this implementation
// (empty for an unscheduled product).
public interface ScheduledProductLookup {

    Optional<MedicineSchedule> scheduleOf(UUID productId);
}
