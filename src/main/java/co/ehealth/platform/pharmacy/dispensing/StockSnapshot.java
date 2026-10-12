package co.ehealth.platform.pharmacy.dispensing;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

// Shelf state for a set of (facility, product) pairs, read once. Pairs with
// no stock simply have an empty picture.
public class StockSnapshot {

    private record Shelf(UUID facilityId, UUID productId) {
    }

    private final Map<Shelf, StockPicture> pictures;

    StockSnapshot(List<LotAvailability> lots, LocalDate today) {
        this.pictures = lots.stream()
                .collect(Collectors.groupingBy(lot -> new Shelf(lot.facilityId(), lot.productId())))
                .entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, entry -> StockPicture.of(entry.getValue(), today)));
    }

    public StockPicture shelf(UUID facilityId, UUID productId) {
        return pictures.getOrDefault(new Shelf(facilityId, productId), StockPicture.EMPTY);
    }
}
