package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.core.audit.AuditLogService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PharmacyStockOrderService {

    private final PharmacyStockOrderRepository orders;
    private final PharmacyStockOrderLineRepository lines;
    private final PharmacyProductRepository products;
    private final PharmacyFacilityProductRepository assortment;
    private final AuditLogService audit;
    private final ObjectMapper mapper;
    private final Clock clock;

    public PharmacyStockOrderService(PharmacyStockOrderRepository orders, PharmacyStockOrderLineRepository lines,
            PharmacyProductRepository products, PharmacyFacilityProductRepository assortment,
            AuditLogService audit, ObjectMapper mapper, Clock clock) {
        this.orders = orders;
        this.lines = lines;
        this.products = products;
        this.assortment = assortment;
        this.audit = audit;
        this.mapper = mapper;
        this.clock = clock;
    }

    public record LineRequest(UUID productId, int quantity) {}
    public record CreateCommand(UUID facilityId, List<LineRequest> lines) {}
    public record OrderLineView(UUID productId, String productCode, String productName, String baseUnit, int quantity) {}
    public record OrderView(UUID id, UUID facilityId, PharmacyStockOrderStatus status, UUID createdBy,
            String createdByName, java.time.Instant createdAt, UUID authorisedBy, String authorisedByName,
            java.time.Instant authorisedAt, java.time.Instant submittedAt, List<OrderLineView> lines) {}

    @Transactional
    public OrderView create(CreateCommand command, UUID actor, String actorName, UUID actorFacilityId) {
        requireFacilityScope(command.facilityId(), actorFacilityId);
        if (command.lines() == null || command.lines().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A stock order must contain at least one catalogue item.");
        }
        Set<UUID> productIds = new HashSet<>();
        List<PharmacyProduct> selectedProducts = new ArrayList<>();
        for (LineRequest requested : command.lines()) {
            if (requested.productId() == null || requested.quantity() <= 0 || !productIds.add(requested.productId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order items must be unique catalogue products with a positive quantity.");
            }
            PharmacyProduct product = products.findById(requested.productId())
                    .orElseThrow(PharmacyProductNotFoundException::new);
            if (!product.isActive() || assortment.findByProductIdAndFacilityId(product.getId(), command.facilityId())
                    .filter(PharmacyFacilityProduct::isActive).isEmpty()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Every order item must be active in the facility's procurement catalogue.");
            }
            selectedProducts.add(product);
        }

        PharmacyStockOrder order = orders.save(new PharmacyStockOrder(command.facilityId(), actor, actorName, clock.instant()));
        List<PharmacyStockOrderLine> savedLines = new ArrayList<>();
        for (int index = 0; index < selectedProducts.size(); index++) {
            savedLines.add(new PharmacyStockOrderLine(order.getId(), selectedProducts.get(index),
                    command.lines().get(index).quantity()));
        }
        lines.saveAll(savedLines);
        audit.append(actor, command.facilityId(), "STOCK_ORDER_CREATED", "PharmacyStockOrder",
            order.getId().toString(), null, json(Map.of(
                "status", PharmacyStockOrderStatus.DRAFT.name(),
                "masterCatalogueProductIds", selectedProducts.stream().map(product -> product.getId().toString()).toList())));
        return view(order, savedLines);
    }

    @Transactional
    public OrderView authorise(UUID orderId, UUID actor, String actorName, UUID actorFacilityId) {
        PharmacyStockOrder order = lockOrder(orderId);
        requireFacilityScope(order.getFacilityId(), actorFacilityId);
        if (order.getStatus() != PharmacyStockOrderStatus.DRAFT) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only draft orders can be authorised.");
        }
        if (order.getCreatedBy().equals(actor)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "The order creator cannot authorise their own order.");
        }
        var authorisedAt = clock.instant();
        order.authorise(actor, actorName, authorisedAt);
        orders.save(order);
        audit.append(actor, order.getFacilityId(), "STOCK_ORDER_AUTHORISED", "PharmacyStockOrder",
            order.getId().toString(), json(Map.of("status", PharmacyStockOrderStatus.DRAFT.name())),
            json(Map.of("status", PharmacyStockOrderStatus.AUTHORISED.name(), "authorisedBy", actor.toString(),
                "authorisedByName", actorName, "authorisedAt", authorisedAt)));
        return view(order, lines.findByOrderIdOrderByIdAsc(orderId));
    }

    @Transactional
    public OrderView submit(UUID orderId, UUID actor, UUID actorFacilityId) {
        PharmacyStockOrder order = lockOrder(orderId);
        requireFacilityScope(order.getFacilityId(), actorFacilityId);
        requireAuthorised(order);
        List<PharmacyStockOrderLine> orderLines = lines.findByOrderIdOrderByIdAsc(orderId);
        for (PharmacyStockOrderLine line : orderLines) {
            PharmacyProduct product = products.findById(line.getProductId())
                    .orElseThrow(PharmacyProductNotFoundException::new);
            if (!product.isActive() || assortment.findByProductIdAndFacilityId(product.getId(), order.getFacilityId())
                    .filter(PharmacyFacilityProduct::isActive).isEmpty()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "An order item is no longer active in the facility's procurement catalogue.");
            }
        }
        var submittedAt = clock.instant();
        order.submit(submittedAt);
        orders.save(order);
        audit.append(actor, order.getFacilityId(), "STOCK_ORDER_SUBMITTED", "PharmacyStockOrder",
            order.getId().toString(), json(Map.of("status", PharmacyStockOrderStatus.AUTHORISED.name())),
            json(Map.of("status", PharmacyStockOrderStatus.SUBMITTED.name(), "submittedAt", submittedAt,
                "masterCatalogueProductIds", orderLines.stream().map(line -> line.getProductId().toString()).toList())));
        return view(order, orderLines);
    }

    @Transactional(readOnly = true)
    public void requireAuthorisedForSubmission(UUID orderId, UUID actorFacilityId) {
        PharmacyStockOrder order = orders.findById(orderId).orElseThrow(PharmacyStockOrderNotFoundException::new);
        requireFacilityScope(order.getFacilityId(), actorFacilityId);
        requireAuthorised(order);
    }

    @Transactional(readOnly = true)
    public OrderView get(UUID orderId, UUID actorFacilityId) {
        PharmacyStockOrder order = orders.findById(orderId).orElseThrow(PharmacyStockOrderNotFoundException::new);
        requireFacilityScope(order.getFacilityId(), actorFacilityId);
        return view(order, lines.findByOrderIdOrderByIdAsc(orderId));
    }

    @Transactional(readOnly = true)
    public List<OrderView> list(UUID facilityId, UUID actorFacilityId) {
        requireFacilityScope(facilityId, actorFacilityId);
        List<PharmacyStockOrder> facilityOrders = orders.findTop50ByFacilityIdOrderByCreatedAtDesc(facilityId);
        if (facilityOrders.isEmpty()) return List.of();
        Map<UUID, List<PharmacyStockOrderLine>> linesByOrder = lines
                .findByOrderIdInOrderByOrderIdAscIdAsc(facilityOrders.stream().map(PharmacyStockOrder::getId).toList())
                .stream().collect(Collectors.groupingBy(PharmacyStockOrderLine::getOrderId));
        return facilityOrders.stream().map(order -> view(order, linesByOrder.getOrDefault(order.getId(), List.of()))).toList();
    }

    private PharmacyStockOrder lockOrder(UUID orderId) {
        return orders.findByIdForUpdate(orderId).orElseThrow(PharmacyStockOrderNotFoundException::new);
    }

    private void requireFacilityScope(UUID orderFacilityId, UUID actorFacilityId) {
        if (actorFacilityId == null || !orderFacilityId.equals(actorFacilityId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Stock orders are restricted to the user's facility.");
        }
    }

    private void requireAuthorised(PharmacyStockOrder order) {
        if (order.getStatus() != PharmacyStockOrderStatus.AUTHORISED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Facility Manager authorisation is required before this order can be submitted.");
        }
    }

    private String json(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("Could not serialize stock order audit data.", error);
        }
    }

    private OrderView view(PharmacyStockOrder order, List<PharmacyStockOrderLine> orderLines) {
        return new OrderView(order.getId(), order.getFacilityId(), order.getStatus(), order.getCreatedBy(),
                order.getCreatedByName(), order.getCreatedAt(), order.getAuthorisedBy(), order.getAuthorisedByName(),
                order.getAuthorisedAt(), order.getSubmittedAt(), orderLines.stream().map(line -> new OrderLineView(
                line.getProductId(), line.getProductCode(), line.getProductName(), line.getBaseUnit(), line.getQuantity())).toList());
    }
}