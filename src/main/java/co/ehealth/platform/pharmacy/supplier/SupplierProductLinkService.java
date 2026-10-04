package co.ehealth.platform.pharmacy.supplier;

import co.ehealth.platform.pharmacy.stock.PharmacyProductNotFoundException;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.UUID;

// Maintains a supplier's order list. Both operations are idempotent — linking
// twice or unlinking something never linked is not an error, so a double
// click or a retry is harmless.
@Service
public class SupplierProductLinkService {

    private final SupplierService supplierService;
    private final PharmacySupplierProductRepository supplierProductRepository;
    private final PharmacyProductRepository productRepository;
    private final Clock clock;

    public SupplierProductLinkService(SupplierService supplierService,
                                      PharmacySupplierProductRepository supplierProductRepository,
                                      PharmacyProductRepository productRepository, Clock clock) {
        this.supplierService = supplierService;
        this.supplierProductRepository = supplierProductRepository;
        this.productRepository = productRepository;
        this.clock = clock;
    }

    @Transactional
    public void link(UUID supplierId, UUID productId) {
        PharmacySupplier supplier = supplierService.get(supplierId);
        if (!supplier.isActive()) {
            throw new InvalidSupplierStateException("\"" + supplier.getName()
                    + "\" is archived. Reactivate it before adding products to its order list.");
        }
        if (!productRepository.existsById(productId)) {
            throw new PharmacyProductNotFoundException();
        }
        var key = new PharmacySupplierProduct.Key(supplierId, productId);
        if (!supplierProductRepository.existsById(key)) {
            supplierProductRepository.save(new PharmacySupplierProduct(supplierId, productId, clock.instant()));
        }
    }

    @Transactional
    public void unlink(UUID supplierId, UUID productId) {
        supplierService.get(supplierId);
        var key = new PharmacySupplierProduct.Key(supplierId, productId);
        if (supplierProductRepository.existsById(key)) {
            supplierProductRepository.deleteById(key);
        }
    }
}
