package co.ehealth.platform.pharmacy.reorder;

import co.ehealth.platform.pharmacy.purchasing.PurchaseOrderRepository;
import co.ehealth.platform.pharmacy.purchasing.SupplierLastOrdered;
import co.ehealth.platform.pharmacy.stock.PharmacyFacilityProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyFacilityProductRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import co.ehealth.platform.pharmacy.supplier.PharmacySupplierProduct;
import co.ehealth.platform.pharmacy.supplier.PharmacySupplierProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

// The two figures on a supplier card: how many of its products need
// ordering at a facility, and when it was last sent an order. Built for a
// whole page of suppliers at once, in a handful of queries.
@Service
public class SupplierOrderSummaryService {

    public record OrderSummary(int toOrderCount, Instant lastOrderedAt) {
    }

    private final PharmacySupplierProductRepository supplierProductRepository;
    private final PharmacyProductRepository productRepository;
    private final PharmacyFacilityProductRepository facilityProductRepository;
    private final FacilityOnHand facilityOnHand;
    private final PurchaseOrderRepository purchaseOrderRepository;

    public SupplierOrderSummaryService(PharmacySupplierProductRepository supplierProductRepository,
                                       PharmacyProductRepository productRepository,
                                       PharmacyFacilityProductRepository facilityProductRepository,
                                       FacilityOnHand facilityOnHand,
                                       PurchaseOrderRepository purchaseOrderRepository) {
        this.supplierProductRepository = supplierProductRepository;
        this.productRepository = productRepository;
        this.facilityProductRepository = facilityProductRepository;
        this.facilityOnHand = facilityOnHand;
        this.purchaseOrderRepository = purchaseOrderRepository;
    }

    @Transactional(readOnly = true)
    public Map<UUID, OrderSummary> summarise(UUID facilityId, Collection<UUID> supplierIds) {
        if (supplierIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, Long> toOrderBySupplier = toOrderCounts(facilityId, supplierIds);
        Map<UUID, Instant> lastOrderedBySupplier = purchaseOrderRepository
                .latestOrderBySupplier(facilityId, supplierIds).stream()
                .collect(Collectors.toMap(SupplierLastOrdered::supplierId, SupplierLastOrdered::orderedAt));
        return supplierIds.stream().collect(Collectors.toMap(Function.identity(),
                supplierId -> new OrderSummary(toOrderBySupplier.getOrDefault(supplierId, 0L).intValue(),
                        lastOrderedBySupplier.get(supplierId))));
    }

    // Same product rules as the reorder sheet: active, in this facility's
    // assortment, and not comfortably in stock.
    private Map<UUID, Long> toOrderCounts(UUID facilityId, Collection<UUID> supplierIds) {
        Map<UUID, PharmacyFacilityProduct> assortmentByProduct = facilityProductRepository
                .findByFacilityIdAndActiveTrue(facilityId).stream()
                .collect(Collectors.toMap(PharmacyFacilityProduct::getProductId, Function.identity()));
        Map<UUID, Long> onHandByProduct = facilityOnHand.byProduct(facilityId);
        List<PharmacySupplierProduct> links = supplierProductRepository.findBySupplierIdIn(supplierIds);
        Set<UUID> activeProductIds = activeProductsAmong(links);

        return links.stream()
                .filter(link -> activeProductIds.contains(link.getProductId()))
                .filter(link -> assortmentByProduct.containsKey(link.getProductId()))
                .filter(link -> needsOrdering(assortmentByProduct.get(link.getProductId()),
                        onHandByProduct.getOrDefault(link.getProductId(), 0L)))
                .collect(Collectors.groupingBy(PharmacySupplierProduct::getSupplierId, Collectors.counting()));
    }

    private Set<UUID> activeProductsAmong(List<PharmacySupplierProduct> links) {
        List<UUID> productIds = links.stream().map(PharmacySupplierProduct::getProductId).distinct().toList();
        return productRepository.findAllById(productIds).stream()
                .filter(PharmacyProduct::isActive)
                .map(PharmacyProduct::getId)
                .collect(Collectors.toSet());
    }

    private boolean needsOrdering(PharmacyFacilityProduct assortment, long onHand) {
        return ReorderSuggestion.statusOf(onHand, assortment.getReorderThreshold()) != ReorderStatus.OK;
    }
}
