package co.ehealth.platform.pharmacy.supplier;

import co.ehealth.platform.pharmacy.stock.SupplierNameLookup;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

// Gives ledger rows their supplier names with one batched lookup. Marked
// @Primary so it replaces the default that returns no names.
@Primary
@Component
class SupplierNameLookupAdapter implements SupplierNameLookup {

    private final PharmacySupplierRepository supplierRepository;

    SupplierNameLookupAdapter(PharmacySupplierRepository supplierRepository) {
        this.supplierRepository = supplierRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, String> namesById(Collection<UUID> supplierIds) {
        Map<UUID, String> names = new HashMap<>();
        if (supplierIds.isEmpty()) {
            return names;
        }
        supplierRepository.findAllById(supplierIds).forEach(supplier -> names.put(supplier.getId(), supplier.getName()));
        return names;
    }
}
