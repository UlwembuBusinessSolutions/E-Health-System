package co.ehealth.platform.pharmacy.receiving;

import co.ehealth.platform.pharmacy.stock.LedgerContext;
import co.ehealth.platform.pharmacy.stock.PharmacyBatchRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyReceipt;
import co.ehealth.platform.pharmacy.stock.PharmacyStockAccount;
import co.ehealth.platform.pharmacy.stock.PharmacyStockAccountRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyStockEntry;
import co.ehealth.platform.pharmacy.stock.PharmacyStockEntryRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyStockLedgerService;
import co.ehealth.platform.pharmacy.stock.PharmacyStockTransaction;
import co.ehealth.platform.pharmacy.stock.StockTransactionType;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

// Default ReceiptStockReverser: posts the REVERSAL straight through
// PharmacyStockLedgerService (the only place quantity may change).
//
// The "is the stock still there?" check is done up front, per lot, only to
// give a friendly message naming the product and lot. The ledger re-checks
// under its account locks and refuses to go negative, so a dispense that
// sneaks in between this check and the posting still cannot corrupt a balance.
@Component
public class LedgerReceiptStockReverser implements ReceiptStockReverser {

    private final PharmacyStockEntryRepository stockEntryRepository;
    private final PharmacyStockAccountRepository stockAccountRepository;
    private final PharmacyStockLedgerService stockLedgerService;
    private final PharmacyProductRepository productRepository;
    private final PharmacyBatchRepository batchRepository;

    public LedgerReceiptStockReverser(PharmacyStockEntryRepository stockEntryRepository,
                                      PharmacyStockAccountRepository stockAccountRepository,
                                      PharmacyStockLedgerService stockLedgerService,
                                      PharmacyProductRepository productRepository,
                                      PharmacyBatchRepository batchRepository) {
        this.stockEntryRepository = stockEntryRepository;
        this.stockAccountRepository = stockAccountRepository;
        this.stockLedgerService = stockLedgerService;
        this.productRepository = productRepository;
        this.batchRepository = batchRepository;
    }

    @Override
    @Transactional
    public PharmacyStockTransaction reverse(PharmacyReceipt receipt, String reason, UUID actorUserId,
                                            String actorName) {
        Map<UUID, Long> receivedByAccountId = stockEntryRepository.findByTransactionId(receipt.getTransactionId())
                .stream().collect(Collectors.groupingBy(PharmacyStockEntry::getStockAccountId,
                        Collectors.summingLong(PharmacyStockEntry::getQuantityDelta)));
        List<PharmacyStockAccount> accounts = stockAccountRepository.findAllById(receivedByAccountId.keySet());
        requireStockStillOnShelf(receipt, accounts, receivedByAccountId);

        List<PharmacyStockLedgerService.EntryRequest> reversalEntries = accounts.stream()
                .map(account -> new PharmacyStockLedgerService.EntryRequest(account.getProductId(),
                        account.getBatchId(), account.getLocationId(), account.getBucket(),
                        -receivedByAccountId.get(account.getId())))
                .toList();
        // The key is derived from the receipt, so the same receipt can only
        // ever be reversed once even if two requests race past the status check.
        String idempotencyKey = "receipt-reversal:" + receipt.getId();
        return stockLedgerService.postEntries(StockTransactionType.REVERSAL, receipt.getFacilityId(), actorUserId,
                actorName, reason, receipt.getReceiptNumber(), idempotencyKey, idempotencyKey,
                new LedgerContext(receipt.getTransactionId(), receipt.getSupplierId(), null, null, null),
                reversalEntries);
    }

    private void requireStockStillOnShelf(PharmacyReceipt receipt, List<PharmacyStockAccount> accounts,
                                          Map<UUID, Long> receivedByAccountId) {
        for (PharmacyStockAccount account : accounts) {
            long received = receivedByAccountId.get(account.getId());
            if (account.getQuantity() < received) {
                throw usedStockProblem(receipt, account, received);
            }
        }
    }

    private ReceiptStockUsedException usedStockProblem(PharmacyReceipt receipt, PharmacyStockAccount account,
                                                       long received) {
        String productName = productRepository.findById(account.getProductId())
                .map(product -> product.getDisplayName()).orElse("this product");
        String lotNumber = batchRepository.findById(account.getBatchId())
                .map(batch -> batch.getLotNumber()).orElse("N/A");
        return new ReceiptStockUsedException(receipt.getReceiptNumber(), productName, lotNumber, received,
                account.getQuantity());
    }
}
