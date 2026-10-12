package co.ehealth.platform.pharmacy.purchasing;

import co.ehealth.platform.pharmacy.stock.PagedResponse;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import co.ehealth.platform.pharmacy.supplier.PharmacySupplier;
import co.ehealth.platform.pharmacy.supplier.PharmacySupplierRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

// The read side of purchase orders. Lines, products and suppliers for a
// whole page are fetched with one query each, however many orders it holds.
@Service
public class PurchaseOrderQueryService {

    static final int MAX_PAGE_SIZE = 100;

    private final PurchaseOrderRepository orderRepository;
    private final PurchaseOrderLineRepository lineRepository;
    private final PharmacyProductRepository productRepository;
    private final PharmacySupplierRepository supplierRepository;

    public PurchaseOrderQueryService(PurchaseOrderRepository orderRepository,
                                     PurchaseOrderLineRepository lineRepository,
                                     PharmacyProductRepository productRepository,
                                     PharmacySupplierRepository supplierRepository) {
        this.orderRepository = orderRepository;
        this.lineRepository = lineRepository;
        this.productRepository = productRepository;
        this.supplierRepository = supplierRepository;
    }

    @Transactional(readOnly = true)
    public PagedResponse<PurchaseOrderResponse> list(UUID facilityId, UUID supplierId, int page, int size) {
        int boundedSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Page<PurchaseOrder> orders = orderRepository.search(facilityId, supplierId,
                PageRequest.of(Math.max(page, 0), boundedSize));
        List<PurchaseOrderResponse> responses = respondTo(orders.getContent());
        return new PagedResponse<>(responses, orders.getNumber(), orders.getSize(), orders.getTotalElements(),
                orders.hasNext());
    }

    @Transactional(readOnly = true)
    public PurchaseOrderResponse detail(UUID orderId) {
        PurchaseOrder order = orderRepository.findById(orderId).orElseThrow();
        return respondTo(List.of(order)).getFirst();
    }

    private List<PurchaseOrderResponse> respondTo(List<PurchaseOrder> orders) {
        if (orders.isEmpty()) {
            return List.of();
        }
        Map<UUID, List<PurchaseOrderLine>> linesByOrder = lineRepository
                .findByPurchaseOrderIdIn(orders.stream().map(PurchaseOrder::getId).toList()).stream()
                .collect(Collectors.groupingBy(PurchaseOrderLine::getPurchaseOrderId));
        Map<UUID, PharmacyProduct> products = productsOf(linesByOrder.values().stream()
                .flatMap(Collection::stream).map(PurchaseOrderLine::getProductId).distinct().toList());
        Map<UUID, PharmacySupplier> suppliers = suppliersOf(orders.stream()
                .map(PurchaseOrder::getSupplierId).distinct().toList());

        return orders.stream()
                .map(order -> responseFor(order, linesByOrder.getOrDefault(order.getId(), List.of()), products,
                        suppliers.get(order.getSupplierId())))
                .toList();
    }

    private PurchaseOrderResponse responseFor(PurchaseOrder order, List<PurchaseOrderLine> lines,
                                              Map<UUID, PharmacyProduct> products, PharmacySupplier supplier) {
        List<PurchaseOrderResponse.Line> lineResponses = lines.stream()
                .map(line -> new PurchaseOrderResponse.Line(line.getProductId(),
                        products.get(line.getProductId()).getDisplayName(), line.getPacks(), line.getPackSize(),
                        line.getQuantity()))
                .toList();
        long totalUnits = lines.stream().mapToLong(PurchaseOrderLine::getQuantity).sum();
        return new PurchaseOrderResponse(order.getId(), order.getPoNumber(), order.getSupplierId(),
                supplier.getName(), order.getCreatedAt(), order.getExpectedDelivery(), order.getCreatedByName(),
                totalUnits, lineResponses);
    }

    private Map<UUID, PharmacyProduct> productsOf(List<UUID> productIds) {
        return productRepository.findAllById(productIds).stream()
                .collect(Collectors.toMap(PharmacyProduct::getId, Function.identity()));
    }

    private Map<UUID, PharmacySupplier> suppliersOf(List<UUID> supplierIds) {
        return supplierRepository.findAllById(supplierIds).stream()
                .collect(Collectors.toMap(PharmacySupplier::getId, Function.identity()));
    }
}
