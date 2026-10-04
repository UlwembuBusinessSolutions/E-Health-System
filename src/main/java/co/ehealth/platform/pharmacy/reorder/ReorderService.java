package co.ehealth.platform.pharmacy.reorder;

import co.ehealth.platform.pharmacy.stock.PharmacyFacilityProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyFacilityProductRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyStockAccount;
import co.ehealth.platform.pharmacy.stock.PharmacyStockAccountRepository;
import co.ehealth.platform.pharmacy.supplier.PharmacySupplier;
import co.ehealth.platform.pharmacy.supplier.PharmacySupplierProduct;
import co.ehealth.platform.pharmacy.supplier.PharmacySupplierProductRepository;
import co.ehealth.platform.pharmacy.supplier.SupplierService;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

// Builds one supplier's order sheet for one facility. Only products on the
// supplier's order list AND in the facility's assortment appear — a product
// the facility never stocks must not show up as "out of stock" there. Stock
// comes from three batched queries, never one per product.
@Service
public class ReorderService {

    private final SupplierService supplierService;
    private final PharmacySupplierProductRepository supplierProductRepository;
    private final PharmacyProductRepository productRepository;
    private final PharmacyFacilityProductRepository facilityProductRepository;
    private final PharmacyStockAccountRepository stockAccountRepository;

    public ReorderService(SupplierService supplierService,
                          PharmacySupplierProductRepository supplierProductRepository,
                          PharmacyProductRepository productRepository,
                          PharmacyFacilityProductRepository facilityProductRepository,
                          PharmacyStockAccountRepository stockAccountRepository) {
        this.supplierService = supplierService;
        this.supplierProductRepository = supplierProductRepository;
        this.productRepository = productRepository;
        this.facilityProductRepository = facilityProductRepository;
        this.stockAccountRepository = stockAccountRepository;
    }

    public record ReorderLine(PharmacyProduct product, long onHand, Integer reorderThreshold,
                              Integer targetQuantity, int suggestedQuantity, ReorderStatus status) {
    }

    public record ReorderSheet(PharmacySupplier supplier, List<ReorderLine> lines) {
    }

    public ReorderSheet buildSheet(UUID supplierId, UUID facilityId) {
        PharmacySupplier supplier = supplierService.get(supplierId);
        List<UUID> linkedProductIds = supplierProductRepository.findBySupplierId(supplierId).stream()
                .map(PharmacySupplierProduct::getProductId).toList();
        Map<UUID, PharmacyFacilityProduct> assortmentByProduct = facilityProductRepository
                .findByFacilityIdAndActiveTrue(facilityId).stream()
                .collect(Collectors.toMap(PharmacyFacilityProduct::getProductId, Function.identity()));
        Map<UUID, Long> onHandByProduct = stockAccountRepository.findPositiveByFacility(facilityId).stream()
                .collect(Collectors.groupingBy(PharmacyStockAccount::getProductId,
                        Collectors.summingLong(PharmacyStockAccount::getQuantity)));

        List<ReorderLine> lines = productRepository.findAllById(linkedProductIds).stream()
                .filter(PharmacyProduct::isActive)
                .filter(product -> assortmentByProduct.containsKey(product.getId()))
                .map(product -> toLine(product, assortmentByProduct.get(product.getId()),
                        onHandByProduct.getOrDefault(product.getId(), 0L)))
                .sorted(Comparator.comparing(ReorderLine::status)
                        .thenComparing(line -> line.product().getDisplayName(), String.CASE_INSENSITIVE_ORDER))
                .toList();
        return new ReorderSheet(supplier, lines);
    }

    private ReorderLine toLine(PharmacyProduct product, PharmacyFacilityProduct assortment, long onHand) {
        int suggested = ReorderSuggestion.suggestedQuantity(assortment.getTargetQuantity(), onHand,
                product.getPackSize());
        return new ReorderLine(product, onHand, assortment.getReorderThreshold(), assortment.getTargetQuantity(),
                suggested, ReorderSuggestion.statusOf(onHand, assortment.getReorderThreshold()));
    }
}
