package co.ehealth.platform.pharmacy.purchasing;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.facility.FacilityNotFoundException;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.pharmacy.PharmacyTestData;
import co.ehealth.platform.pharmacy.purchasing.PurchaseOrderService.CreateCommand;
import co.ehealth.platform.pharmacy.purchasing.PurchaseOrderService.LineCommand;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyValidationException;
import co.ehealth.platform.pharmacy.supplier.InvalidSupplierStateException;
import co.ehealth.platform.pharmacy.supplier.PharmacySupplier;
import co.ehealth.platform.pharmacy.supplier.SupplierService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PurchaseOrderServiceTest {

    private final FacilityRepository facilityRepository = mock(FacilityRepository.class);
    private final SupplierService supplierService = mock(SupplierService.class);
    private final PharmacyProductRepository productRepository = mock(PharmacyProductRepository.class);
    private final PurchaseOrderRepository orderRepository = mock(PurchaseOrderRepository.class);
    private final PurchaseOrderLineRepository lineRepository = mock(PurchaseOrderLineRepository.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final PurchaseOrderService service = new PurchaseOrderService(facilityRepository, supplierService,
            productRepository, orderRepository, lineRepository, auditLogService, PharmacyTestData.CLOCK);

    private final UUID facilityId = UUID.randomUUID();
    private final UUID actorId = UUID.randomUUID();
    private PharmacySupplier supplier;
    private PharmacyProduct amoxicillin;

    @BeforeEach
    void setUp() {
        supplier = PharmacyTestData.supplier("Cipla Medpro");
        amoxicillin = PharmacyTestData.lotTrackedProduct("AMOX-500", "Amoxicillin 500 mg");
        when(facilityRepository.existsById(facilityId)).thenReturn(true);
        when(supplierService.get(supplier.getId())).thenReturn(supplier);
        when(productRepository.findAllById(anyCollection())).thenReturn(List.of(amoxicillin));
        when(orderRepository.nextOrderNumberValue()).thenReturn(42L);
        when(orderRepository.save(any(PurchaseOrder.class))).thenAnswer(invocation -> {
            PurchaseOrder order = invocation.getArgument(0);
            ReflectionTestUtils.setField(order, "id", UUID.randomUUID());
            return order;
        });
    }

    private CreateCommand order(LineCommand... lines) {
        return new CreateCommand(facilityId, supplier.getId(), LocalDate.parse("2026-10-10"), List.of(lines));
    }

    private LineCommand threePacksOf30() {
        return new LineCommand(amoxicillin.getId(), 3, 30, 90);
    }

    @Test
    void createsTheOrderWithASequenceBasedNumberAndTheCreatorsName() {
        PurchaseOrder created = service.create(order(threePacksOf30()), actorId, "Thandi Nkosi");

        assertEquals("PO-000042", created.getPoNumber());
        assertEquals("Thandi Nkosi", created.getCreatedByName());
        assertEquals(LocalDate.parse("2026-10-10"), created.getExpectedDelivery());
        assertEquals(supplier.getId(), created.getSupplierId());
    }

    @Test
    void savesEveryLineAgainstTheNewOrder() {
        PurchaseOrder created = service.create(order(threePacksOf30()), actorId, "Thandi Nkosi");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<PurchaseOrderLine>> saved = ArgumentCaptor.forClass(List.class);
        verify(lineRepository).saveAll(saved.capture());
        PurchaseOrderLine line = saved.getValue().getFirst();
        assertEquals(created.getId(), line.getPurchaseOrderId());
        assertEquals(90, line.getQuantity());
        assertEquals(3, line.getPacks());
        assertEquals(30, line.getPackSize());
    }

    @Test
    void writesTheCreationToTheAuditLog() {
        PurchaseOrder created = service.create(order(threePacksOf30()), actorId, "Thandi Nkosi");

        verify(auditLogService).append(eq(actorId), eq(facilityId), eq("PURCHASE_ORDER_CREATED"), eq("PurchaseOrder"),
                eq(created.getId().toString()), isNull(), anyString());
    }

    @Test
    void refusesAQuantityThatIsNotPacksTimesPackSizeAndSavesNothing() {
        assertThrows(PharmacyValidationException.class,
                () -> service.create(order(new LineCommand(amoxicillin.getId(), 3, 30, 91)), actorId, "Thandi"));

        verify(orderRepository, never()).save(any());
        verify(auditLogService, never()).append(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void refusesAnArchivedSupplier() {
        supplier.archive(PharmacyTestData.CLOCK.instant());

        assertThrows(InvalidSupplierStateException.class,
                () -> service.create(order(threePacksOf30()), actorId, "Thandi"));

        verify(orderRepository, never()).save(any());
    }

    @Test
    void refusesAProductThatNoLongerExists() {
        when(productRepository.findAllById(anyCollection())).thenReturn(List.of());

        assertThrows(PharmacyValidationException.class,
                () -> service.create(order(threePacksOf30()), actorId, "Thandi"));

        verify(orderRepository, never()).save(any());
    }

    @Test
    void refusesAnUnknownFacility() {
        when(facilityRepository.existsById(facilityId)).thenReturn(false);

        assertThrows(FacilityNotFoundException.class,
                () -> service.create(order(threePacksOf30()), actorId, "Thandi"));
    }
}
