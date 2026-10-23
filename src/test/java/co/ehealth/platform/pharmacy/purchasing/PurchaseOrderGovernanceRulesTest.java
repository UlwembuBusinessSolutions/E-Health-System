package co.ehealth.platform.pharmacy.purchasing;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class PurchaseOrderGovernanceRulesTest {
    private static final Instant NOW = Instant.parse("2026-10-22T10:00:00Z");
    private final UUID creator = UUID.randomUUID();
    private final UUID manager = UUID.randomUUID();

    private PurchaseOrder draft() {
        return new PurchaseOrder("PO-000001", UUID.randomUUID(), UUID.randomUUID(), null,
                creator, "Stock Control Manager", NOW);
    }

    @Test
    void cannotSubmitAnUnapprovedOrder() {
        assertEquals(PurchaseOrderStatus.DRAFT, draft().getStatus());
        assertThrows(IllegalStateException.class, () -> draft().ensureTransmittable());
    }

    @Test
    void makerCannotApproveTheirOwnOrder() {
        PurchaseOrder order = draft();
        assertThrows(IllegalStateException.class, () -> order.authorize(creator, "Self", NOW));
        assertEquals(PurchaseOrderStatus.DRAFT, order.getStatus());
    }

    @Test
    void approvalCapturesManagerAndTimestampThenPermitsSubmission() {
        PurchaseOrder order = draft();
        order.authorize(manager, "Facility Manager", NOW);
        assertEquals(PurchaseOrderStatus.AUTHORIZED, order.getStatus());
        assertEquals(manager, order.getAuthorizedBy());
        assertEquals("Facility Manager", order.getAuthorizedByName());
        assertEquals(NOW, order.getAuthorizedAt());
        order.submitted("MPC-ACK-42", NOW.plusSeconds(45));
        assertEquals(PurchaseOrderStatus.SUBMITTED, order.getStatus());
        assertEquals("MPC-ACK-42", order.getCatalogueReference());
        assertNotNull(order.getSubmittedAt());
    }

    @Test
    void catalogueFailureNeverMarksOrderSubmittedAndAllowsRetry() {
        PurchaseOrder order = draft();
        order.authorize(manager, "Facility Manager", NOW);
        order.transmissionFailed("gateway offline");
        assertEquals(PurchaseOrderStatus.TRANSMISSION_FAILED, order.getStatus());
        assertNull(order.getSubmittedAt());
        assertEquals("gateway offline", order.getTransmissionError());
        order.submitted("MPC-RETRY-1", NOW.plusSeconds(120));
        assertEquals(PurchaseOrderStatus.SUBMITTED, order.getStatus());
        assertNull(order.getTransmissionError());
    }

    @Test
    void rejectedOrderCannotBeAuthorizedOrSubmitted() {
        PurchaseOrder order = draft();
        order.reject();
        assertEquals(PurchaseOrderStatus.REJECTED, order.getStatus());
        assertThrows(IllegalStateException.class, () -> order.authorize(manager, "Manager", NOW));
        assertThrows(IllegalStateException.class, order::ensureTransmittable);
    }

    @Test
    void authorizingTwiceDoesNotChangeOriginalAuditIdentity() {
        PurchaseOrder order = draft();
        order.authorize(manager, "Facility Manager", NOW);
        assertThrows(IllegalStateException.class, () -> order.authorize(UUID.randomUUID(), "Someone", NOW.plusSeconds(15)));
        assertEquals(manager, order.getAuthorizedBy());
        assertEquals(NOW, order.getAuthorizedAt());
    }
}
