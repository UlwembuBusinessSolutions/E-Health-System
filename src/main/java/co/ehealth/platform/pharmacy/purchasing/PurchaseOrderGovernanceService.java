package co.ehealth.platform.pharmacy.purchasing;

import co.ehealth.platform.core.audit.AuditDetails;
import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class PurchaseOrderGovernanceService {
    private final PurchaseOrderRepository orders;
    private final PurchaseOrderLineRepository lines;
    private final UserRepository users;
    private final PharmacyProductRepository products;
    private final MasterProcurementCatalogueClient catalogue;
    private final AuditLogService audit;
    private final Clock clock;

    public PurchaseOrderGovernanceService(PurchaseOrderRepository orders, PurchaseOrderLineRepository lines,
            UserRepository users, PharmacyProductRepository products, MasterProcurementCatalogueClient catalogue,
            AuditLogService audit, Clock clock) {
        this.orders = orders;
        this.lines = lines;
        this.users = users;
        this.products = products;
        this.catalogue = catalogue;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional
    public void authorize(UUID id, User actor) {
        PurchaseOrder order = locked(id);
        // A facility manager cannot approve an order for a different clinic.
        if (!users.isAssignedToFacility(actor.getId(), order.getFacilityId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Facility manager must belong to the ordering facility");
        }
        try {
            order.authorize(actor.getId(), name(actor), clock.instant());
        } catch (IllegalStateException e) { throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage()); }
        audit.append(actor.getId(), order.getFacilityId(), "PURCHASE_ORDER_AUTHORIZED", "PurchaseOrder",
                id.toString(), null, AuditDetails.of("authorizedBy", actor.getId(), "authorizedAt", order.getAuthorizedAt()));
    }

    @Transactional
    public void reject(UUID id, User actor) {
        PurchaseOrder order = locked(id);
        if (!users.isAssignedToFacility(actor.getId(), order.getFacilityId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Facility manager must belong to the ordering facility");
        }
        try { order.reject(); }
        catch (IllegalStateException e) { throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage()); }
        audit.append(actor.getId(), order.getFacilityId(), "PURCHASE_ORDER_REJECTED", "PurchaseOrder", id.toString(), null,
                AuditDetails.of("rejectedBy", actor.getId()));
    }

    @Transactional
    public void submit(UUID id, User actor) {
        PurchaseOrder order = locked(id);
        try { order.ensureTransmittable(); }
        catch (IllegalStateException e) { throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage()); }
        List<PurchaseOrderLine> orderedLines = lines.findByPurchaseOrderIdIn(List.of(id));
        Map<UUID, PharmacyProduct> productMap = products.findAllById(orderedLines.stream()
                .map(PurchaseOrderLine::getProductId).distinct().toList()).stream()
                .collect(Collectors.toMap(PharmacyProduct::getId, Function.identity()));
        if (orderedLines.isEmpty() || orderedLines.stream().anyMatch(line -> !productMap.containsKey(line.getProductId())
                || productMap.get(line.getProductId()).getCode() == null
                || productMap.get(line.getProductId()).getCode().isBlank())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Order lines must have valid product catalogue codes");
        }
        var payload = new MasterProcurementCatalogueClient.CatalogueOrder(order.getPoNumber(),
                order.getFacilityId(), order.getSupplierId(), orderedLines.stream()
                .map(line -> new MasterProcurementCatalogueClient.CatalogueLine(
                        productMap.get(line.getProductId()).getCode(), line.getPacks(), line.getPackSize(),
                        line.getQuantity())).toList());
        try {
            String reference = catalogue.transmit(payload);
            order.submitted(reference, clock.instant());
            audit.append(actor.getId(), order.getFacilityId(), "PURCHASE_ORDER_SUBMITTED", "PurchaseOrder",
                    id.toString(), null, AuditDetails.of("catalogueReference", reference,
                    "authorizedBy", order.getAuthorizedBy()));
        } catch (IllegalStateException error) {
            // Failure is persisted in the same tenant schema; a failed attempt never counts as submitted.
            order.transmissionFailed(error.getMessage());
            audit.append(actor.getId(), order.getFacilityId(), "PURCHASE_ORDER_TRANSMISSION_FAILED",
                    "PurchaseOrder", id.toString(), null, AuditDetails.of("reason", error.getMessage()));
        }
    }

    private PurchaseOrder locked(UUID id) {
        return orders.findByIdForUpdate(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Purchase order not found"));
    }

    private String name(User actor) { return actor.getFirstName() + " " + actor.getLastName(); }
}
