package co.ehealth.platform.pharmacy.stock;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

// The read side — facility stock balances and per-product batches (the
// ledger listing lives in PharmacyLedgerQueryService). Never writes anything
// (PharmacyStockLedgerService owns every quantity change); this only
// projects what's already posted.
@Service
public class PharmacyStockQueryService {

    private final PharmacyStockAccountRepository stockAccountRepository;
    private final PharmacyProductRepository productRepository;
    private final PharmacyBatchRepository batchRepository;
    private final PharmacyFacilityProductRepository facilityProductRepository;
    private final SerialUnitGateway serialUnitGateway;

    public PharmacyStockQueryService(PharmacyStockAccountRepository stockAccountRepository,
                                      PharmacyProductRepository productRepository,
                                      PharmacyBatchRepository batchRepository,
                                      PharmacyFacilityProductRepository facilityProductRepository,
                                      SerialUnitGateway serialUnitGateway) {
        this.stockAccountRepository = stockAccountRepository;
        this.productRepository = productRepository;
        this.batchRepository = batchRepository;
        this.facilityProductRepository = facilityProductRepository;
        this.serialUnitGateway = serialUnitGateway;
    }

    // One row per product with positive stock somewhere at this facility —
    // plan section 11's Stock table. Balances are summed across batches
    // (AVAILABLE bucket only exists in Phase 1, so this is already the
    // eligible-to-dispense total; Phase 2's HELD bucket will need this to
    // subtract, not just filter, once it posts).
    public List<ProductStockBalance> listFacilityBalances(UUID facilityId) {
        List<PharmacyStockAccount> accounts = stockAccountRepository.findPositiveByFacility(facilityId);
        Map<UUID, Long> totalsByProduct = accounts.stream()
                .collect(Collectors.groupingBy(PharmacyStockAccount::getProductId,
                        Collectors.summingLong(PharmacyStockAccount::getQuantity)));
        Map<UUID, PharmacyFacilityProduct> assortmentByProduct = facilityProductRepository
                .findByFacilityIdAndActiveTrue(facilityId).stream()
                .collect(Collectors.toMap(PharmacyFacilityProduct::getProductId, fp -> fp));

        return totalsByProduct.entrySet().stream().map(entry -> {
            PharmacyProduct product = productRepository.findById(entry.getKey()).orElseThrow();
            PharmacyFacilityProduct assortment = assortmentByProduct.get(entry.getKey());
            return new ProductStockBalance(product, entry.getValue(),
                    assortment != null ? assortment.getReorderThreshold() : null);
        }).sorted((a, b) -> a.product().getDisplayName().compareToIgnoreCase(b.product().getDisplayName())).toList();
    }

    public record ProductStockBalance(PharmacyProduct product, long available, Integer reorderThreshold) {
    }

    public List<PharmacyBatch> listBatches(UUID productId) {
        return batchRepository.findByProductIdOrderByExpiryDateAsc(productId);
    }

    // Serials on the shelf per lot, for the batch list of a serial-tracked product.
    public Map<UUID, List<String>> inStockSerialsByBatch(UUID productId) {
        return serialUnitGateway.inStockSerialsByBatch(productId);
    }

    public List<PharmacyStockAccount> listAccountsForProduct(UUID productId) {
        return stockAccountRepository.findByProductId(productId);
    }
}
