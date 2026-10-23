package co.ehealth.platform.pharmacy.stock;

import java.util.Arrays;
import java.util.Optional;

// The ?status= values GET /stock accepts. The filtering itself happens in
// SQL (PharmacyStockWorklistRepository.listStock) so paging stays in the
// database; this only validates the query parameter.
public enum StockStatusFilter {
    LOW, OUT, EXPIRING;

    public static Optional<StockStatusFilter> parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        return Optional.of(Arrays.stream(values())
                .filter(filter -> filter.name().equalsIgnoreCase(raw.trim()))
                .findFirst()
                .orElseThrow(() -> new InvalidStockRequestException("Unknown stock status \"" + raw
                        + "\". Use LOW, OUT or EXPIRING.")));
    }
}
