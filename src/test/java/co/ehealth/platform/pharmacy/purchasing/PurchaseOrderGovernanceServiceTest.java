package co.ehealth.platform.pharmacy.purchasing;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.identity.Gender;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PurchaseOrderGovernanceServiceTest {
    private final PurchaseOrderRepository orders = mock(PurchaseOrderRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final PurchaseOrderGovernanceService service = new PurchaseOrderGovernanceService(
            orders, mock(PurchaseOrderLineRepository.class), users, mock(PharmacyProductRepository.class),
            mock(MasterProcurementCatalogueClient.class), mock(AuditLogService.class), Clock.systemUTC());

    @Test
    void allowsManagerAssignedToOrderFacilityEvenWhenItIsNotTheirPrimaryFacility() {
        UUID facilityId = UUID.randomUUID();
        User manager = user(UUID.randomUUID(), UUID.randomUUID());
        PurchaseOrder order = draft(facilityId, UUID.randomUUID());
        when(orders.findByIdForUpdate(order.getId())).thenReturn(Optional.of(order));
        when(users.isAssignedToFacility(manager.getId(), facilityId)).thenReturn(true);

        service.authorize(order.getId(), manager);

        assertEquals(PurchaseOrderStatus.AUTHORIZED, order.getStatus());
        verify(users).isAssignedToFacility(manager.getId(), facilityId);
    }

    @Test
    void refusesManagerNotAssignedToOrderFacility() {
        UUID facilityId = UUID.randomUUID();
        User manager = user(UUID.randomUUID(), UUID.randomUUID());
        PurchaseOrder order = draft(facilityId, UUID.randomUUID());
        when(orders.findByIdForUpdate(order.getId())).thenReturn(Optional.of(order));
        when(users.isAssignedToFacility(manager.getId(), facilityId)).thenReturn(false);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.authorize(order.getId(), manager));

        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
        assertEquals("Facility manager must belong to the ordering facility", error.getReason());
        assertEquals(PurchaseOrderStatus.DRAFT, order.getStatus());
    }

    private static PurchaseOrder draft(UUID facilityId, UUID creatorId) {
        PurchaseOrder order = new PurchaseOrder("PO-000001", facilityId, UUID.randomUUID(), null,
                creatorId, "Order creator", Instant.parse("2026-10-22T10:00:00Z"));
        ReflectionTestUtils.setField(order, "id", UUID.randomUUID());
        return order;
    }

    private static User user(UUID id, UUID primaryFacilityId) {
        User user = new User("FM-1", "manager@example.org", "Facility", "Manager",
                null, "hash", primaryFacilityId, Gender.OTHER);
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }
}
