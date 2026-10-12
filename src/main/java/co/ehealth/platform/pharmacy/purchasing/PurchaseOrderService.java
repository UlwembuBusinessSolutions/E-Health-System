package co.ehealth.platform.pharmacy.purchasing;

import co.ehealth.platform.core.audit.AuditDetails;
import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.facility.FacilityNotFoundException;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyValidationException;
import co.ehealth.platform.pharmacy.supplier.InvalidSupplierStateException;
import co.ehealth.platform.pharmacy.supplier.PharmacySupplier;
import co.ehealth.platform.pharmacy.supplier.SupplierService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

// Raising a purchase order. The order and its lines are written together,
// and the order number comes from a database sequence so concurrent orders
// never share one.
@Service
public class PurchaseOrderService {

    public record LineCommand(UUID productId, int packs, int packSize, int quantity) {
    }

    public record CreateCommand(UUID facilityId, UUID supplierId, LocalDate expectedDelivery,
                                List<LineCommand> lines) {
    }

    private final FacilityRepository facilityRepository;
    private final SupplierService supplierService;
    private final PharmacyProductRepository productRepository;
    private final PurchaseOrderRepository orderRepository;
    private final PurchaseOrderLineRepository lineRepository;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public PurchaseOrderService(FacilityRepository facilityRepository, SupplierService supplierService,
                                PharmacyProductRepository productRepository, PurchaseOrderRepository orderRepository,
                                PurchaseOrderLineRepository lineRepository, AuditLogService auditLogService,
                                Clock clock) {
        this.facilityRepository = facilityRepository;
        this.supplierService = supplierService;
        this.productRepository = productRepository;
        this.orderRepository = orderRepository;
        this.lineRepository = lineRepository;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    @Transactional
    public PurchaseOrder create(CreateCommand command, UUID actorUserId, String actorName) {
        if (!facilityRepository.existsById(command.facilityId())) {
            throw new FacilityNotFoundException();
        }
        requireActive(supplierService.get(command.supplierId()));
        List<PurchaseOrderRules.LineDraft> drafts = command.lines().stream()
                .map(line -> new PurchaseOrderRules.LineDraft(line.productId(), line.packs(), line.packSize(),
                        line.quantity()))
                .toList();
        PurchaseOrderRules.requireValidLines(drafts);
        requireProductsExist(command.lines());

        PurchaseOrder order = orderRepository.save(new PurchaseOrder(nextOrderNumber(), command.facilityId(),
                command.supplierId(), command.expectedDelivery(), actorUserId, actorName, clock.instant()));
        lineRepository.saveAll(command.lines().stream()
                .map(line -> new PurchaseOrderLine(order.getId(), line.productId(), line.packs(), line.packSize(),
                        line.quantity()))
                .toList());
        auditCreation(order, command.lines());
        return order;
    }

    private void requireActive(PharmacySupplier supplier) {
        if (!supplier.isActive()) {
            throw new InvalidSupplierStateException("\"" + supplier.getName()
                    + "\" is archived. Reactivate the supplier before ordering from them.");
        }
    }

    // One query for every product on the order, not one per line.
    private void requireProductsExist(List<LineCommand> lines) {
        List<UUID> productIds = lines.stream().map(LineCommand::productId).distinct().toList();
        long found = productRepository.findAllById(productIds).stream().map(PharmacyProduct::getId).distinct()
                .count();
        if (found != productIds.size()) {
            throw new PharmacyValidationException(
                    "One of the products on this order no longer exists. Remove it and try again.");
        }
    }

    private String nextOrderNumber() {
        return String.format("PO-%06d", orderRepository.nextOrderNumberValue());
    }

    private void auditCreation(PurchaseOrder order, List<LineCommand> lines) {
        long totalUnits = lines.stream().mapToLong(LineCommand::quantity).sum();
        auditLogService.append(order.getCreatedBy(), order.getFacilityId(), "PURCHASE_ORDER_CREATED",
                "PurchaseOrder", order.getId().toString(), null,
                AuditDetails.of("poNumber", order.getPoNumber(), "supplierId", order.getSupplierId(),
                        "lines", lines.size(), "units", totalUnits));
    }
}
