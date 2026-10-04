package co.ehealth.platform.pharmacy.dispensing;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

// What one product looks like on one facility's shelf today: lots that may
// be dispensed (in date, first-expiring-first) and lots that may not.
// Lots with no stock are dropped — they are neither usable nor worth
// warning about.
public record StockPicture(List<LotAvailability> usableLots, List<LotAvailability> expiredLots) {

    private static final Comparator<LotAvailability> FIRST_EXPIRING_FIRST = Comparator
            .comparing(LotAvailability::expiryDate, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(LotAvailability::lotNumber);

    public static final StockPicture EMPTY = new StockPicture(List.of(), List.of());

    public static StockPicture of(List<LotAvailability> lots, LocalDate today) {
        List<LotAvailability> withStock = lots.stream().filter(lot -> lot.available() > 0).toList();
        List<LotAvailability> usable = withStock.stream().filter(lot -> !lot.isExpiredAsOf(today))
                .sorted(FIRST_EXPIRING_FIRST).toList();
        List<LotAvailability> expired = withStock.stream().filter(lot -> lot.isExpiredAsOf(today))
                .sorted(FIRST_EXPIRING_FIRST).toList();
        return new StockPicture(usable, expired);
    }

    public long usableTotal() {
        return usableLots.stream().mapToLong(LotAvailability::available).sum();
    }

    // The lot to point the pharmacist at: the first-expiring lot that covers
    // the whole quantity on its own, otherwise simply the first-expiring
    // usable lot (the dispense will then draw across lots in the same order).
    public Optional<LotAvailability> suggestedLot(int quantity) {
        return usableLots.stream().filter(lot -> lot.available() >= quantity).findFirst()
                .or(() -> usableLots.stream().findFirst());
    }

    public Optional<LotAvailability> findLot(UUID batchId) {
        return Stream.concat(usableLots.stream(), expiredLots.stream())
                .filter(lot -> lot.batchId().equals(batchId)).findFirst();
    }
}
