package co.ehealth.platform.pharmacy.openingstock;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityNotFoundException;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.pharmacy.openingstock.OpeningStockRowValidator.RowCheck;
import co.ehealth.platform.pharmacy.receiving.PharmacyBatchResolver;
import co.ehealth.platform.pharmacy.stock.ExpiryPrecision;
import co.ehealth.platform.pharmacy.stock.PharmacyBatch;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyProductService;
import co.ehealth.platform.pharmacy.stock.PharmacyStockLedgerService;
import co.ehealth.platform.pharmacy.stock.PharmacyStockLocation;
import co.ehealth.platform.pharmacy.stock.PharmacyStockLocationService;
import co.ehealth.platform.pharmacy.stock.PharmacyStockTransaction;
import co.ehealth.platform.pharmacy.stock.PharmacyValidationException;
import co.ehealth.platform.pharmacy.stock.StockBucket;
import co.ehealth.platform.pharmacy.stock.StockIntakeEvent;
import co.ehealth.platform.pharmacy.stock.StockTransactionType;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

// Loads a facility's starting stock once, from a sheet. Every row is
// validated first (the same verdicts the preview shows), then the whole
// sheet is posted as ONE OPENING_BALANCE ledger transaction — so it either
// all lands or none of it does.
//
// Opening stock may be loaded only once per facility: a second load would
// silently double the shelf. Later corrections are adjustments, which leave
// a reason on the ledger.
@Service
public class OpeningStockService {

    private final FacilityRepository facilityRepository;
    private final PharmacyProductRepository productRepository;
    private final PharmacyProductService productService;
    private final OpeningStockRowValidator rowValidator;
    private final OpeningStockLedgerRepository ledgerRepository;
    private final PharmacyBatchResolver batchResolver;
    private final PharmacyStockLocationService stockLocationService;
    private final PharmacyStockLedgerService stockLedgerService;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher eventPublisher;

    public OpeningStockService(FacilityRepository facilityRepository, PharmacyProductRepository productRepository,
                               PharmacyProductService productService,
                               OpeningStockRowValidator rowValidator, OpeningStockLedgerRepository ledgerRepository,
                               PharmacyBatchResolver batchResolver, PharmacyStockLocationService stockLocationService,
                               PharmacyStockLedgerService stockLedgerService, AuditLogService auditLogService,
                               ObjectMapper objectMapper, ApplicationEventPublisher eventPublisher) {
        this.eventPublisher = eventPublisher;
        this.facilityRepository = facilityRepository;
        this.productRepository = productRepository;
        this.productService = productService;
        this.rowValidator = rowValidator;
        this.ledgerRepository = ledgerRepository;
        this.batchResolver = batchResolver;
        this.stockLocationService = stockLocationService;
        this.stockLedgerService = stockLedgerService;
        this.auditLogService = auditLogService;
        this.objectMapper = objectMapper;
    }

    public record OpeningStockResult(UUID transactionId, int rowsLoaded, long totalUnits) {
    }

    public List<RowCheck> validate(List<OpeningStockRow> rows) {
        return rowValidator.check(rows, loadProductsByKey(rows));
    }

    @Transactional
    public OpeningStockResult post(UUID facilityId, List<OpeningStockRow> rows, UUID actorUserId,
                                   String actorName) {
        Facility facility = facilityRepository.findById(facilityId).orElseThrow(FacilityNotFoundException::new);
        if (ledgerRepository.existsByFacilityIdAndType(facilityId, StockTransactionType.OPENING_BALANCE)) {
            throw new OpeningStockAlreadyLoadedException();
        }
        List<RowCheck> checks = validate(rows);
        requireEveryRowOk(checks);

        PharmacyStockLocation location = stockLocationService.getOrCreateMainLocation(facility.getId());
        List<PharmacyStockLedgerService.EntryRequest> entryRequests = checks.stream()
                .map(check -> entryRequestFor(check, facility, location, actorUserId, actorName))
                .toList();

        // One opening balance per facility, so the key can be derived from it:
        // a retried request replays the original instead of loading twice.
        String idempotencyKey = "opening-stock:" + facility.getId();
        PharmacyStockTransaction transaction = stockLedgerService.postEntries(StockTransactionType.OPENING_BALANCE,
                facility.getId(), actorUserId, actorName, "Opening stock", null, idempotencyKey, idempotencyKey,
                entryRequests);

        eventPublisher.publishEvent(new StockIntakeEvent(facility.getId(), actorUserId, transaction.getId(), true,
                checks.stream().map(check -> new StockIntakeEvent.IntakeLot(check.product().getId(), check.lot(),
                        check.quantity())).toList()));

        long totalUnits = checks.stream().mapToLong(RowCheck::quantity).sum();
        auditLogService.append(actorUserId, facility.getId(), "OPENING_STOCK_LOADED", "PharmacyStockTransaction",
                transaction.getId().toString(), null, summaryJson(checks.size(), totalUnits));
        return new OpeningStockResult(transaction.getId(), checks.size(), totalUnits);
    }

    private Map<String, PharmacyProduct> loadProductsByKey(List<OpeningStockRow> rows) {
        List<String> keys = rows.stream().map(row -> OpeningStockRowValidator.productKey(row.sku()))
                .filter(key -> !key.isEmpty()).distinct().toList();
        if (keys.isEmpty()) {
            return Map.of();
        }
        return productRepository.findByCodeNormalizedIn(keys).stream()
                .collect(Collectors.toMap(product -> OpeningStockRowValidator.productKey(product.getCode()),
                        Function.identity()));
    }

    private void requireEveryRowOk(List<RowCheck> checks) {
        long problemRows = checks.stream().filter(check -> !check.isOk()).count();
        if (problemRows > 0) {
            throw new PharmacyValidationException(problemRows + " row" + (problemRows == 1 ? " needs" : "s need")
                    + " fixing before the stock can be loaded. Run the check again to see which.");
        }
    }

    private PharmacyStockLedgerService.EntryRequest entryRequestFor(RowCheck check, Facility facility,
                                                                    PharmacyStockLocation location,
                                                                    UUID actorUserId, String actorName) {
        PharmacyProduct product = check.product();
        productService.getOrCreateAssortment(product.getId(), facility.getId(), null, null);
        ExpiryPrecision precision = check.expiry() == null ? null : ExpiryPrecision.DAY;
        PharmacyBatch batch = batchResolver.resolve(product, product.getManufacturer(), check.lot(), check.expiry(),
                precision, actorUserId, actorName);
        return new PharmacyStockLedgerService.EntryRequest(product.getId(), batch.getId(), location.getId(),
                StockBucket.AVAILABLE, check.quantity());
    }

    private record OpeningStockSummary(int rows, long totalUnits) {
    }

    private String summaryJson(int rows, long totalUnits) {
        try {
            return objectMapper.writeValueAsString(new OpeningStockSummary(rows, totalUnits));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialise the opening stock audit entry", e);
        }
    }
}
