package co.ehealth.platform.pharmacy.count;

import co.ehealth.platform.pharmacy.stock.PharmacyProduct;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

// One lot row. While a blind count is still a draft, everything that would
// reveal the system quantity — baseline, expected, variance and the large
// flag (which is derived from it) — is null.
public record StockCountLineResponse(UUID id, UUID productId, String productName, String productCode,
                                     String lotNumber, LocalDate expiryDate, boolean foundInCount,
                                     Long countedQuantity, Long baselineQuantity, Long expectedQuantity,
                                     Long variance, Boolean large, String reason, Instant countedAt) {

    // liveBalance is only used for a line nobody has counted yet in a
    // visible (non-blind) count, so the counter can see what is expected.
    static StockCountLineResponse from(PharmacyStockCountLine line, PharmacyProduct product,
                                       boolean revealBaselines, Long liveBalance) {
        Long baseline = revealBaselines ? line.getBaselineQuantity() : null;
        Long expected = !revealBaselines ? null : (line.isCounted() ? line.getBaselineQuantity() : liveBalance);
        Long variance = revealBaselines && line.isCounted() ? line.variance() : null;
        Boolean large = variance == null ? null : CountVariance.isLarge(line.getBaselineQuantity(), variance);
        return new StockCountLineResponse(line.getId(), line.getProductId(), product.getDisplayName(),
                product.getCode(), line.getLotNumber(), line.getExpiryDate(), line.isFoundInCount(),
                line.getCountedQuantity(), baseline, expected, variance, large, line.getReason(),
                line.getBaselineTakenAt());
    }
}
