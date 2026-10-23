package co.ehealth.platform.pharmacy.stock;

import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;

// Default until the suppliers table exists: no ledger row carries a supplier
// id yet, so there are no names to resolve.
@Component
class UnwiredSupplierNameLookup implements SupplierNameLookup {

    @Override
    public Map<UUID, String> namesById(Collection<UUID> supplierIds) {
        return Map.of();
    }
}
