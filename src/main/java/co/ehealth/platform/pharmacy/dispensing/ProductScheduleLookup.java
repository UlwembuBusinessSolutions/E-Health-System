package co.ehealth.platform.pharmacy.dispensing;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;

// Reads a product's Schedule 5/6 classification without this package
// depending on the product catalogue's newer columns (added by agent B2).
// The integrator wires an implementation backed by the product repository;
// until then DispensingDefaultsConfig treats every product as unscheduled.
public interface ProductScheduleLookup {

    // Only scheduled products appear in the result; absent means unscheduled.
    // Takes many ids so the queue view needs one lookup, not one per item.
    Map<UUID, MedicineSchedule> schedulesFor(Collection<UUID> productIds);
}
