package co.ehealth.platform.pharmacy.count;

import co.ehealth.platform.facility.FacilityNotFoundException;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyStockAccount;
import co.ehealth.platform.pharmacy.stock.PharmacyStockLocationService;
import co.ehealth.platform.pharmacy.stock.StockBucket;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

// The read side of "start a count": what could be counted here and when each
// area was last counted. Nothing is created or locked — it only summarises
// the stock on the books.
@Service
public class StockCountSetupService {

    private final FacilityRepository facilityRepository;
    private final PharmacyStockLocationService stockLocationService;
    private final CountStockAccountRepository stockAccountRepository;
    private final PharmacyProductRepository productRepository;
    private final PharmacyStockCountRepository countRepository;

    public StockCountSetupService(FacilityRepository facilityRepository,
                                  PharmacyStockLocationService stockLocationService,
                                  CountStockAccountRepository stockAccountRepository,
                                  PharmacyProductRepository productRepository,
                                  PharmacyStockCountRepository countRepository) {
        this.facilityRepository = facilityRepository;
        this.stockLocationService = stockLocationService;
        this.stockAccountRepository = stockAccountRepository;
        this.productRepository = productRepository;
        this.countRepository = countRepository;
    }

    public CountSetupResponse setup(UUID facilityId) {
        if (!facilityRepository.existsById(facilityId)) {
            throw new FacilityNotFoundException();
        }
        UUID locationId = stockLocationService.getOrCreateMainLocation(facilityId).getId();
        List<PharmacyStockAccount> stockedLots = stockAccountRepository.findStocked(locationId,
                StockBucket.AVAILABLE);

        Map<String, Instant> lastCountedByLabel = lastCountedByLowerCaseLabel(facilityId);
        List<CountSetupResponse.AreaSummary> areas = CountAreas.derive(storagePerLot(stockedLots)).stream()
                .map(area -> new CountSetupResponse.AreaSummary(area.label(), area.lotCount(),
                        lastCountedByLabel.get(area.label().toLowerCase(Locale.ROOT))))
                .toList();
        return new CountSetupResponse(stockedLots.size(), areas);
    }

    // Product storage text for each stocked lot, products fetched in one query.
    private List<String> storagePerLot(List<PharmacyStockAccount> stockedLots) {
        List<UUID> productIds = stockedLots.stream().map(PharmacyStockAccount::getProductId).distinct().toList();
        Map<UUID, PharmacyProduct> products = productRepository.findAllById(productIds).stream()
                .collect(Collectors.toMap(PharmacyProduct::getId, Function.identity()));
        return stockedLots.stream()
                .map(lot -> products.get(lot.getProductId()).getStorageInstructions())
                .toList();
    }

    private Map<String, Instant> lastCountedByLowerCaseLabel(UUID facilityId) {
        return countRepository.latestPostedAreaCounts(facilityId).stream()
                .collect(Collectors.toMap(last -> last.scopeLabel().toLowerCase(Locale.ROOT),
                        AreaLastCounted::postedAt, (first, second) -> first.isAfter(second) ? first : second));
    }
}
