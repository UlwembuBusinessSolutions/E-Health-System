package co.ehealth.platform.pharmacy.purchasing;

import java.time.Instant;
import java.util.UUID;

// When a supplier was last sent an order. Public because Hibernate
// instantiates it from the constructor expression in
// PurchaseOrderRepository.latestOrderBySupplier().
public record SupplierLastOrdered(UUID supplierId, Instant orderedAt) {
}
