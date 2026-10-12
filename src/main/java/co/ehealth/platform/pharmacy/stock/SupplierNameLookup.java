package co.ehealth.platform.pharmacy.stock;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;

// Resolves supplier ids shown on ledger rows to display names. Suppliers
// arrive with the suppliers migration (V42), so the ledger reads names only
// through this interface.
//
// WIRING (integrator): provide a @Primary @Component implementation backed by
// the suppliers table (one batched IN query); it replaces
// UnwiredSupplierNameLookup without that class needing to be deleted.
public interface SupplierNameLookup {

    Map<UUID, String> namesById(Collection<UUID> supplierIds);
}
