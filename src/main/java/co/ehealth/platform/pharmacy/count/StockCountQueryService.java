package co.ehealth.platform.pharmacy.count;

import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

// The read side of counts, and the one place that decides what a blind
// count may show.
@Service
public class StockCountQueryService {

    private final PharmacyStockCountRepository countRepository;
    private final PharmacyStockCountLineRepository lineRepository;
    private final PharmacyProductRepository productRepository;
    private final CountLotBalances lotBalances;
    private final StockCountLookup lookup;

    public StockCountQueryService(PharmacyStockCountRepository countRepository,
                                  PharmacyStockCountLineRepository lineRepository,
                                  PharmacyProductRepository productRepository, CountLotBalances lotBalances,
                                  StockCountLookup lookup) {
        this.countRepository = countRepository;
        this.lineRepository = lineRepository;
        this.productRepository = productRepository;
        this.lotBalances = lotBalances;
        this.lookup = lookup;
    }

    // Drafts and past counts for a facility, newest first. All the lines
    // are loaded in one query rather than once per count.
    @Transactional(readOnly = true)
    public List<StockCountResponse> list(UUID facilityId, CountStatus status) {
        List<PharmacyStockCount> counts = status == null
                ? countRepository.findByFacilityIdOrderByStartedAtDesc(facilityId)
                : countRepository.findByFacilityIdAndStatusOrderByStartedAtDesc(facilityId, status);
        Map<UUID, List<PharmacyStockCountLine>> linesByCount = lineRepository
                .findByCountIdIn(counts.stream().map(PharmacyStockCount::getId).toList()).stream()
                .collect(Collectors.groupingBy(PharmacyStockCountLine::getCountId));
        return counts.stream()
                .map(count -> StockCountResponse.summaryOf(count, linesByCount.getOrDefault(count.getId(), List.of())))
                .toList();
    }

    public StockCountResponse detail(UUID countId) {
        return detail(countId, false);
    }

    // revealSystem lets the counter see the system quantity of the lines
    // they have already counted on a blind draft (the "review before
    // posting" step). Lines still to be counted stay hidden, otherwise the
    // reveal would hand out the answers to the rest of the count.
    @Transactional(readOnly = true)
    public StockCountResponse detail(UUID countId, boolean revealSystem) {
        PharmacyStockCount count = lookup.requireCount(countId);
        List<PharmacyStockCountLine> lines = lineRepository.findByCountId(countId);
        Map<UUID, PharmacyProduct> products = productsOf(lines);
        Map<CountLotBalances.LotKey, Long> liveBalances = liveBalancesFor(count, lines);

        List<StockCountLineResponse> lineResponses = lines.stream()
                .map(line -> lineResponse(count, line, products.get(line.getProductId()), liveBalances, revealSystem))
                .sorted(Comparator.comparing(StockCountLineResponse::productName, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(StockCountLineResponse::lotNumber))
                .toList();
        return StockCountResponse.detailOf(count, lines, lineResponses, revealSystem);
    }

    @Transactional(readOnly = true)
    public StockCountLineResponse line(UUID countId, UUID lineId) {
        PharmacyStockCount count = lookup.requireCount(countId);
        PharmacyStockCountLine line = lookup.requireLine(countId, lineId);
        PharmacyProduct product = productRepository.findById(line.getProductId()).orElseThrow();
        return StockCountLineResponse.from(line, product, !count.hidesBaselines(), null);
    }

    private StockCountLineResponse lineResponse(PharmacyStockCount count, PharmacyStockCountLine line,
                                                PharmacyProduct product,
                                                Map<CountLotBalances.LotKey, Long> liveBalances,
                                                boolean revealSystem) {
        Long liveBalance = liveBalances.get(new CountLotBalances.LotKey(line.getProductId(), line.getBatchId()));
        boolean revealBaseline = !count.hidesBaselines() || (revealSystem && line.isCounted());
        return StockCountLineResponse.from(line, product, revealBaseline, liveBalance);
    }

    private Map<UUID, PharmacyProduct> productsOf(List<PharmacyStockCountLine> lines) {
        List<UUID> productIds = lines.stream().map(PharmacyStockCountLine::getProductId).distinct().toList();
        return productRepository.findAllById(productIds).stream()
                .collect(Collectors.toMap(PharmacyProduct::getId, Function.identity()));
    }

    // Live balances are only needed to show "expected" on lines still to
    // be counted in a visible draft; every other case reads the line itself.
    private Map<CountLotBalances.LotKey, Long> liveBalancesFor(PharmacyStockCount count,
                                                                List<PharmacyStockCountLine> lines) {
        if (!count.isDraft() || count.hidesBaselines()) {
            return Map.of();
        }
        List<UUID> uncountedProducts = lines.stream().filter(line -> !line.isCounted())
                .map(PharmacyStockCountLine::getProductId).distinct().toList();
        return lotBalances.balancesForProducts(count.getLocationId(), uncountedProducts);
    }
}
