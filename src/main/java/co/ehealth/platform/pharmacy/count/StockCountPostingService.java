package co.ehealth.platform.pharmacy.count;

import co.ehealth.platform.core.audit.AuditDetails;
import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyStockLedgerService;
import co.ehealth.platform.pharmacy.stock.StockBucket;
import co.ehealth.platform.pharmacy.stock.StockTransactionType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

// Turns a finished count into ledger adjustments. Each line with a
// difference becomes one ADJUSTMENT_POSITIVE/NEGATIVE of (counted −
// baseline) against the live balance, so movements made after the line was
// counted are preserved. Lines that were never counted are left alone.
@Service
public class StockCountPostingService {

    private final PharmacyStockCountRepository countRepository;
    private final PharmacyStockCountLineRepository lineRepository;
    private final PharmacyProductRepository productRepository;
    private final PharmacyStockLedgerService stockLedgerService;
    private final FoundLotBatches foundLotBatches;
    private final StockCountLookup lookup;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public StockCountPostingService(PharmacyStockCountRepository countRepository,
                                    PharmacyStockCountLineRepository lineRepository,
                                    PharmacyProductRepository productRepository,
                                    PharmacyStockLedgerService stockLedgerService, FoundLotBatches foundLotBatches,
                                    StockCountLookup lookup, AuditLogService auditLogService, Clock clock) {
        this.countRepository = countRepository;
        this.lineRepository = lineRepository;
        this.productRepository = productRepository;
        this.stockLedgerService = stockLedgerService;
        this.foundLotBatches = foundLotBatches;
        this.lookup = lookup;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    // Posting a count that is already POSTED returns it untouched; the row
    // lock makes a concurrent second post wait and then take that path.
    // Each ledger posting also carries a key derived from count + line, so
    // even a retry after a failure part-way can never adjust a line twice.
    @Transactional
    public PharmacyStockCount post(UUID countId, UUID actorUserId, String actorName) {
        PharmacyStockCount count = countRepository.findByIdForUpdate(countId)
                .orElseThrow(StockCountNotFoundException::new);
        if (count.isPosted()) {
            return count;
        }
        lookup.requireStillDraft(count);

        List<PharmacyStockCountLine> lines = lineRepository.findByCountId(countId);
        requireSomethingCounted(lines);
        List<PharmacyStockCountLine> varianceLines = lines.stream().filter(PharmacyStockCountLine::hasVariance)
                .toList();
        requireReasons(varianceLines);

        String reference = nextReference();
        postAdjustments(count, varianceLines, reference, actorUserId, actorName);
        count.markPosted(reference, actorUserId, actorName, clock.instant());
        auditLogService.append(actorUserId, count.getFacilityId(), "STOCK_COUNT_POSTED", "PharmacyStockCount",
                count.getId().toString(), null,
                AuditDetails.of("reference", reference, "adjustments", varianceLines.size()));
        return count;
    }

    private void requireSomethingCounted(List<PharmacyStockCountLine> lines) {
        if (lines.stream().noneMatch(PharmacyStockCountLine::isCounted)) {
            throw new InvalidStockCountException("Count at least one lot before posting.");
        }
    }

    private void requireReasons(List<PharmacyStockCountLine> varianceLines) {
        List<PharmacyStockCountLine> withoutReason = varianceLines.stream()
                .filter(line -> !line.hasReason()).toList();
        if (withoutReason.isEmpty()) {
            return;
        }
        Map<UUID, String> productNames = productNamesFor(withoutReason);
        Map<String, String> descriptions = new LinkedHashMap<>();
        withoutReason.forEach(line -> descriptions.put(line.getId().toString(),
                productNames.get(line.getProductId()) + ", lot " + line.getLotNumber()));
        throw new MissingCountReasonsException(descriptions);
    }

    private Map<UUID, String> productNamesFor(List<PharmacyStockCountLine> lines) {
        List<UUID> productIds = lines.stream().map(PharmacyStockCountLine::getProductId).distinct().toList();
        return productRepository.findAllById(productIds).stream()
                .collect(Collectors.toMap(PharmacyProduct::getId, PharmacyProduct::getDisplayName));
    }

    private void postAdjustments(PharmacyStockCount count, List<PharmacyStockCountLine> varianceLines,
                                 String reference, UUID actorUserId, String actorName) {
        varianceLines.stream()
                .filter(line -> line.getBatchId() == null)
                .forEach(line -> line.assignBatch(foundLotBatches.resolveOrCreate(line, actorUserId, actorName)
                        .getId()));

        // Same (product, batch) order for every count keeps two counts that
        // overlap on stock from locking accounts in opposite orders.
        varianceLines.stream()
                .sorted(Comparator.comparing(PharmacyStockCountLine::getProductId)
                        .thenComparing(PharmacyStockCountLine::getBatchId))
                .forEach(line -> postAdjustment(count, line, reference, actorUserId, actorName));
    }

    private void postAdjustment(PharmacyStockCount count, PharmacyStockCountLine line, String reference,
                                UUID actorUserId, String actorName) {
        long variance = line.variance();
        StockTransactionType type = variance > 0 ? StockTransactionType.ADJUSTMENT_POSITIVE
                : StockTransactionType.ADJUSTMENT_NEGATIVE;
        var entry = new PharmacyStockLedgerService.EntryRequest(line.getProductId(), line.getBatchId(),
                count.getLocationId(), StockBucket.AVAILABLE, variance);
        stockLedgerService.postEntries(type, count.getFacilityId(), actorUserId, actorName, line.getReason(),
                reference, idempotencyKey(count, line), bodyHash(count, line, variance), List.of(entry));
    }

    private String idempotencyKey(PharmacyStockCount count, PharmacyStockCountLine line) {
        return "stock-count-" + count.getId() + "-line-" + line.getId();
    }

    private String nextReference() {
        return String.format("CNT-%06d", countRepository.nextReferenceSequenceValue());
    }

    private String bodyHash(PharmacyStockCount count, PharmacyStockCountLine line, long variance) {
        String canonical = count.getId() + "|" + line.getId() + "|" + line.getBatchId() + "|" + variance;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }
}
