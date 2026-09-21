package co.ehealth.platform.pharmacy.stock;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

// The read side — facility stock balances, per-product batches, and the
// ledger listing. Never writes anything (PharmacyStockLedgerService owns
// every quantity change); this only projects what's already posted.
@Service
public class PharmacyStockQueryService {

    public static final int MAX_PAGE_SIZE = 100;

    private final PharmacyStockAccountRepository stockAccountRepository;
    private final PharmacyProductRepository productRepository;
    private final PharmacyBatchRepository batchRepository;
    private final PharmacyStockEntryRepository stockEntryRepository;
    private final PharmacyStockTransactionRepository stockTransactionRepository;
    private final PharmacyFacilityProductRepository facilityProductRepository;

    public PharmacyStockQueryService(PharmacyStockAccountRepository stockAccountRepository,
                                      PharmacyProductRepository productRepository,
                                      PharmacyBatchRepository batchRepository,
                                      PharmacyStockEntryRepository stockEntryRepository,
                                      PharmacyStockTransactionRepository stockTransactionRepository,
                                      PharmacyFacilityProductRepository facilityProductRepository) {
        this.stockAccountRepository = stockAccountRepository;
        this.productRepository = productRepository;
        this.batchRepository = batchRepository;
        this.stockEntryRepository = stockEntryRepository;
        this.stockTransactionRepository = stockTransactionRepository;
        this.facilityProductRepository = facilityProductRepository;
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

    public List<PharmacyStockAccount> listAccountsForProduct(UUID productId) {
        return stockAccountRepository.findByProductId(productId);
    }

    public Page<LedgerRow> listLedger(UUID facilityId, UUID productId, int page, int size) {
        int boundedSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(Math.max(page, 0), boundedSize, Sort.unsorted());
        Page<PharmacyStockEntry> entries = stockEntryRepository.findLedger(facilityId, productId, pageable);
        return entries.map(entry -> {
            PharmacyStockAccount account = stockAccountRepository.findById(entry.getStockAccountId()).orElseThrow();
            PharmacyProduct product = productRepository.findById(account.getProductId()).orElseThrow();
            PharmacyStockTransaction transaction = stockTransactionRepository.findById(entry.getTransactionId())
                    .orElseThrow();
            PharmacyBatch batch = batchRepository.findById(account.getBatchId()).orElse(null);
            return new LedgerRow(entry, account, product, transaction, batch);
        });
    }

    public record LedgerRow(PharmacyStockEntry entry, PharmacyStockAccount account, PharmacyProduct product,
                             PharmacyStockTransaction transaction, PharmacyBatch batch) {
    }
}
