package co.ehealth.platform.pharmacy.count;

import co.ehealth.platform.facility.FacilityNotFoundException;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyStockLocation;
import co.ehealth.platform.pharmacy.stock.PharmacyStockLocationService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;
import java.util.UUID;

// Starting and discarding counts. Starting only lists the lots to count —
// no baseline quantity is taken here, because a baseline is only meaningful
// at the moment a line is actually counted (StockCountRecordingService).
@Service
public class StockCountService {

    public record StartCountCommand(UUID facilityId, CountScope scope, String areaLabel, String productQuery,
                                    boolean blind) {
    }

    private final FacilityRepository facilityRepository;
    private final PharmacyStockLocationService stockLocationService;
    private final StockCountScopeResolver scopeResolver;
    private final PharmacyStockCountRepository countRepository;
    private final PharmacyStockCountLineRepository lineRepository;
    private final StockCountLookup lookup;
    private final Clock clock;

    public StockCountService(FacilityRepository facilityRepository, PharmacyStockLocationService stockLocationService,
                             StockCountScopeResolver scopeResolver, PharmacyStockCountRepository countRepository,
                             PharmacyStockCountLineRepository lineRepository, StockCountLookup lookup,
                             Clock clock) {
        this.facilityRepository = facilityRepository;
        this.stockLocationService = stockLocationService;
        this.scopeResolver = scopeResolver;
        this.countRepository = countRepository;
        this.lineRepository = lineRepository;
        this.lookup = lookup;
        this.clock = clock;
    }

    @Transactional
    public PharmacyStockCount start(StartCountCommand command, UUID actorUserId, String actorName) {
        if (!facilityRepository.existsById(command.facilityId())) {
            throw new FacilityNotFoundException();
        }
        String scopeText = scopeTextFor(command);
        PharmacyStockLocation location = stockLocationService.getOrCreateMainLocation(command.facilityId());

        List<StockCountScopeResolver.ScopedLot> lots = scopeResolver.resolve(location.getId(), command.scope(),
                scopeText);
        if (lots.isEmpty()) {
            throw new InvalidStockCountException("No stock on hand matches this count. Choose a wider scope.");
        }

        PharmacyStockCount count = countRepository.save(new PharmacyStockCount(command.facilityId(),
                location.getId(), command.scope(), scopeText, command.blind(), actorUserId, actorName,
                clock.instant()));
        lineRepository.saveAll(lots.stream()
                .map(lot -> PharmacyStockCountLine.forLedgerLot(count.getId(), lot.productId(), lot.batchId(),
                        lot.lotNumber(), lot.expiryDate()))
                .toList());
        return count;
    }

    // Cancelling twice is harmless; cancelling a posted count is not
    // possible because its adjustments are already in the ledger.
    @Transactional
    public PharmacyStockCount cancel(UUID countId) {
        PharmacyStockCount count = lookup.requireCount(countId);
        if (count.isPosted()) {
            throw new InvalidStockCountStateException(
                    "This count has already been posted. Use the ledger to reverse its adjustments.");
        }
        if (count.isDraft()) {
            count.cancel();
        }
        return count;
    }

    private String scopeTextFor(StartCountCommand command) {
        return switch (command.scope()) {
            case ALL -> null;
            case AREA -> requireText(command.areaLabel(), "Enter the area to count.");
            case PRODUCT -> requireText(command.productQuery(), "Enter the product to count.");
        };
    }

    private String requireText(String text, String message) {
        if (text == null || text.isBlank()) {
            throw new InvalidStockCountException(message);
        }
        return text.trim();
    }
}
