package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.core.audit.AuditLogService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import org.mockito.ArgumentCaptor;

class PharmacyStockOrderServiceTest {

    private static final UUID FACILITY_ID = UUID.randomUUID();
    private static final UUID ORDER_ID = UUID.randomUUID();
    private static final UUID CREATOR_ID = UUID.randomUUID();
    private static final UUID MANAGER_ID = UUID.randomUUID();
    private static final Instant NOW = Instant.parse("2026-10-07T12:00:00Z");

    private PharmacyStockOrderRepository orders;
    private PharmacyStockOrderLineRepository lines;
    private PharmacyProductRepository products;
    private PharmacyFacilityProductRepository assortment;
    private AuditLogService audit;
    private ObjectMapper mapper;
    private PharmacyStockOrderService service;

    @BeforeEach
    void setUp() {
        orders = mock(PharmacyStockOrderRepository.class);
        lines = mock(PharmacyStockOrderLineRepository.class);
        products = mock(PharmacyProductRepository.class);
        assortment = mock(PharmacyFacilityProductRepository.class);
        audit = mock(AuditLogService.class);
        mapper = new ObjectMapper().findAndRegisterModules();
        service = new PharmacyStockOrderService(orders, lines, products, assortment, audit, mapper,
            Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void pendingAuthorisationCannotBeSubmittedAndExplainsRequiredApproval() {
        PharmacyStockOrder order = draftOrder();
        when(orders.findByIdForUpdate(ORDER_ID)).thenReturn(Optional.of(order));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.submit(ORDER_ID, MANAGER_ID, FACILITY_ID));

        assertEquals(409, error.getStatusCode().value());
        assertEquals("Facility Manager authorisation is required before this order can be submitted.", error.getReason());
        assertEquals(PharmacyStockOrderStatus.DRAFT, order.getStatus());
    }

    @Test
    void authorisationRecordsManagerAndServerTimestamp() {
        PharmacyStockOrder order = draftOrder();
        when(orders.findByIdForUpdate(ORDER_ID)).thenReturn(Optional.of(order));

        PharmacyStockOrderService.OrderView result = service.authorise(ORDER_ID, MANAGER_ID, "Facility Manager",
                FACILITY_ID);

        assertEquals(PharmacyStockOrderStatus.AUTHORISED, result.status());
        assertEquals(MANAGER_ID, result.authorisedBy());
        assertEquals("Facility Manager", result.authorisedByName());
        assertEquals(NOW, result.authorisedAt());
        verify(orders).save(order);
    }

    @Test
    void createWritesJsonCompatibleAuditSnapshot() throws Exception {
        UUID productId = UUID.randomUUID();
        PharmacyProduct product = mock(PharmacyProduct.class);
        when(product.getId()).thenReturn(productId);
        when(product.getBaseUnit()).thenReturn(StockBaseUnit.TABLET);
        when(product.isActive()).thenReturn(true);
        PharmacyFacilityProduct facilityProduct = mock(PharmacyFacilityProduct.class);
        when(facilityProduct.isActive()).thenReturn(true);
        when(products.findById(productId)).thenReturn(Optional.of(product));
        when(assortment.findByProductIdAndFacilityId(productId, FACILITY_ID)).thenReturn(Optional.of(facilityProduct));
        when(orders.save(any(PharmacyStockOrder.class))).thenAnswer(invocation -> {
            PharmacyStockOrder order = invocation.getArgument(0);
            ReflectionTestUtils.setField(order, "id", ORDER_ID);
            return order;
        });

        service.create(new PharmacyStockOrderService.CreateCommand(FACILITY_ID,
                        List.of(new PharmacyStockOrderService.LineRequest(productId, 3))),
                CREATOR_ID, "Stock Controller", FACILITY_ID);

        ArgumentCaptor<String> auditSnapshot = ArgumentCaptor.forClass(String.class);
        verify(audit).append(eq(CREATOR_ID), eq(FACILITY_ID), eq("STOCK_ORDER_CREATED"),
                eq("PharmacyStockOrder"), eq(ORDER_ID.toString()), isNull(), auditSnapshot.capture());
        JsonNode parsedSnapshot = mapper.readTree(auditSnapshot.getValue());
        assertEquals("DRAFT", parsedSnapshot.get("status").asText());
        assertEquals(productId.toString(), parsedSnapshot.get("masterCatalogueProductIds").get(0).asText());
        assertTrue(parsedSnapshot.isObject());
    }

    @Test
    void authorisedOrderCanBeSubmittedAgainstItsCatalogueProducts() {
        UUID productId = UUID.randomUUID();
        PharmacyProduct product = mock(PharmacyProduct.class);
        when(product.getId()).thenReturn(productId);
        when(product.getBaseUnit()).thenReturn(StockBaseUnit.TABLET);
        when(product.isActive()).thenReturn(true);
        PharmacyFacilityProduct facilityProduct = mock(PharmacyFacilityProduct.class);
        when(facilityProduct.isActive()).thenReturn(true);
        when(products.findById(productId)).thenReturn(Optional.of(product));
        when(assortment.findByProductIdAndFacilityId(productId, FACILITY_ID)).thenReturn(Optional.of(facilityProduct));

        PharmacyStockOrder order = draftOrder();
        order.authorise(MANAGER_ID, "Facility Manager", NOW.minusSeconds(60));
        PharmacyStockOrderLine orderLine = new PharmacyStockOrderLine(ORDER_ID, product, 4);
        when(orders.findByIdForUpdate(ORDER_ID)).thenReturn(Optional.of(order));
        when(lines.findByOrderIdOrderByIdAsc(ORDER_ID)).thenReturn(java.util.List.of(orderLine));

        PharmacyStockOrderService.OrderView result = service.submit(ORDER_ID, CREATOR_ID, FACILITY_ID);

        assertEquals(PharmacyStockOrderStatus.SUBMITTED, result.status());
        assertEquals(NOW, result.submittedAt());
        assertEquals(MANAGER_ID, result.authorisedBy());
        assertEquals(productId, result.lines().getFirst().productId());
        verify(orders).save(order);
    }

    @Test
    void creatorCannotAuthoriseOwnOrder() {
        PharmacyStockOrder order = draftOrder();
        when(orders.findByIdForUpdate(ORDER_ID)).thenReturn(Optional.of(order));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.authorise(ORDER_ID, CREATOR_ID, "Stock Controller", FACILITY_ID));

        assertEquals(403, error.getStatusCode().value());
        assertEquals(PharmacyStockOrderStatus.DRAFT, order.getStatus());
    }

    private PharmacyStockOrder draftOrder() {
        PharmacyStockOrder order = new PharmacyStockOrder(FACILITY_ID, CREATOR_ID, "Stock Controller", NOW);
        ReflectionTestUtils.setField(order, "id", ORDER_ID);
        return order;
    }
}