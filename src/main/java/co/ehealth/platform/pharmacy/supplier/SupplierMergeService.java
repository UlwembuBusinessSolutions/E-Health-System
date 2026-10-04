package co.ehealth.platform.pharmacy.supplier;

import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyReceiptRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.UUID;

// Folds a duplicate supplier into the real one. Everything that pointed at
// the source — receipts, product order lists, products' preferred supplier —
// moves to the target in ONE transaction, so a failure half way never leaves
// receipts split across two copies of the same company.
@Service
public class SupplierMergeService {

    private final SupplierService supplierService;
    private final PharmacySupplierRepository supplierRepository;
    private final PharmacySupplierProductRepository supplierProductRepository;
    private final PharmacyReceiptRepository receiptRepository;
    private final PharmacyProductRepository productRepository;
    private final Clock clock;

    public SupplierMergeService(SupplierService supplierService, PharmacySupplierRepository supplierRepository,
                                PharmacySupplierProductRepository supplierProductRepository,
                                PharmacyReceiptRepository receiptRepository,
                                PharmacyProductRepository productRepository, Clock clock) {
        this.supplierService = supplierService;
        this.supplierRepository = supplierRepository;
        this.supplierProductRepository = supplierProductRepository;
        this.receiptRepository = receiptRepository;
        this.productRepository = productRepository;
        this.clock = clock;
    }

    @Transactional
    public PharmacySupplier merge(UUID sourceSupplierId, UUID targetSupplierId) {
        if (sourceSupplierId.equals(targetSupplierId)) {
            throw new InvalidSupplierStateException("A supplier can't be merged into itself. Pick a different supplier to keep.");
        }
        PharmacySupplier source = supplierService.get(sourceSupplierId);
        PharmacySupplier target = supplierService.get(targetSupplierId);
        if (source.wasMerged()) {
            throw new InvalidSupplierStateException("\"" + source.getName() + "\" has already been merged into another supplier.");
        }
        if (!target.isActive()) {
            throw new InvalidSupplierStateException("\"" + target.getName()
                    + "\" is archived. Reactivate it first, or merge into an active supplier.");
        }

        receiptRepository.repointSupplier(sourceSupplierId, targetSupplierId);
        supplierProductRepository.copyLinks(sourceSupplierId, targetSupplierId);
        supplierProductRepository.deleteAllForSupplier(sourceSupplierId);
        productRepository.repointPreferredSupplier(sourceSupplierId, targetSupplierId);

        source.archiveAsMergedInto(targetSupplierId, clock.instant());
        supplierRepository.save(source);
        return target;
    }
}
