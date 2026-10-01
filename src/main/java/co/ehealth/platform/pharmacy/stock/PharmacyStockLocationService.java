package co.ehealth.platform.pharmacy.stock;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.UUID;

// Phase 1 never exposes location management directly (PharmacyStockLocation's
// own why-note) — every facility gets exactly one "Main" location, created
// lazily the first time anything posts against that facility.
@Service
public class PharmacyStockLocationService {

    private static final String MAIN_LOCATION_CODE = "MAIN";

    private final PharmacyStockLocationRepository stockLocationRepository;
    private final Clock clock;

    public PharmacyStockLocationService(PharmacyStockLocationRepository stockLocationRepository, Clock clock) {
        this.stockLocationRepository = stockLocationRepository;
        this.clock = clock;
    }

    @Transactional
    public PharmacyStockLocation getOrCreateMainLocation(UUID facilityId) {
        return stockLocationRepository.findByFacilityIdAndCode(facilityId, MAIN_LOCATION_CODE)
                .orElseGet(() -> stockLocationRepository.save(
                        new PharmacyStockLocation(facilityId, MAIN_LOCATION_CODE, "Main", clock.instant())));
    }
}
