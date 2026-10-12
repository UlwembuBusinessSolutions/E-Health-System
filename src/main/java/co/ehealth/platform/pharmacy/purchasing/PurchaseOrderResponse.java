package co.ehealth.platform.pharmacy.purchasing;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

// A purchase order as the screens show it. totalUnits is the sum of the
// lines' quantities.
public record PurchaseOrderResponse(UUID id, String poNumber, UUID supplierId, String supplierName,
                                    Instant createdAt, LocalDate expectedDelivery, String createdByName,
                                    long totalUnits, List<Line> lines) {

    public record Line(UUID productId, String productName, int packs, int packSize, int quantity) {
    }
}
