package co.ehealth.platform.pharmacy.dispensing;

import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;

// Reads lot balances and decides "today" for expiry. The clock is UTC —
// facilities have no timezone of their own yet — so a lot printed to expire
// on a given date stays usable until that UTC day ends.
@Component
public class StockLotReader {

    private final DispensingLotRepository lotRepository;
    private final Clock clock;

    public StockLotReader(DispensingLotRepository lotRepository, Clock clock) {
        this.lotRepository = lotRepository;
        this.clock = clock;
    }

    public StockSnapshot snapshot(Collection<UUID> facilityIds, Collection<UUID> productIds) {
        LocalDate today = LocalDate.now(clock);
        if (facilityIds.isEmpty() || productIds.isEmpty()) {
            return new StockSnapshot(List.of(), today);
        }
        return new StockSnapshot(lotRepository.findAvailableLots(facilityIds, productIds), today);
    }

    public StockPicture shelf(UUID facilityId, UUID productId) {
        return snapshot(Set.of(facilityId), Set.of(productId)).shelf(facilityId, productId);
    }
}
