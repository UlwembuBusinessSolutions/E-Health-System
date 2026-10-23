package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientRepository;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

// Turns a page of bare ledger entries into display rows. Everything a row
// needs is fetched with one batched IN query per table (accounts, products,
// lots, transactions, patients, reversals, suppliers, outflows) — seven round trips for
// the page, however many rows it holds, instead of seven per row.
@Component
class LedgerRowAssembler {

    private final PharmacyStockAccountRepository stockAccountRepository;
    private final PharmacyProductRepository productRepository;
    private final PharmacyBatchRepository batchRepository;
    private final PharmacyStockTransactionRepository stockTransactionRepository;
    private final PharmacyStockEntryRepository stockEntryRepository;
    private final PatientRepository patientRepository;
    private final SupplierNameLookup supplierNameLookup;

    LedgerRowAssembler(PharmacyStockAccountRepository stockAccountRepository,
                       PharmacyProductRepository productRepository, PharmacyBatchRepository batchRepository,
                       PharmacyStockTransactionRepository stockTransactionRepository,
                       PharmacyStockEntryRepository stockEntryRepository,
                       PatientRepository patientRepository, SupplierNameLookup supplierNameLookup) {
        this.stockAccountRepository = stockAccountRepository;
        this.productRepository = productRepository;
        this.batchRepository = batchRepository;
        this.stockTransactionRepository = stockTransactionRepository;
        this.stockEntryRepository = stockEntryRepository;
        this.patientRepository = patientRepository;
        this.supplierNameLookup = supplierNameLookup;
    }

    List<LedgerRow> assemble(List<PharmacyStockEntry> entries) {
        if (entries.isEmpty()) {
            return List.of();
        }
        Map<UUID, PharmacyStockAccount> accounts = byId(stockAccountRepository.findAllById(
                ids(entries, PharmacyStockEntry::getStockAccountId)), PharmacyStockAccount::getId);
        Map<UUID, PharmacyStockTransaction> transactions = byId(stockTransactionRepository.findAllById(
                ids(entries, PharmacyStockEntry::getTransactionId)), PharmacyStockTransaction::getId);
        Map<UUID, PharmacyProduct> products = byId(productRepository.findAllById(
                ids(accounts.values(), PharmacyStockAccount::getProductId)), PharmacyProduct::getId);
        Map<UUID, PharmacyBatch> batches = byId(batchRepository.findAllById(
                ids(accounts.values(), PharmacyStockAccount::getBatchId)), PharmacyBatch::getId);
        Map<UUID, String> patientNames = patientNames(ids(transactions.values(), PharmacyStockTransaction::getPatientId));
        Map<UUID, String> supplierNames = supplierNameLookup.namesById(
                ids(transactions.values(), PharmacyStockTransaction::getSupplierId));
        Map<UUID, UUID> reversalByOriginal = stockTransactionRepository
                .findByReversalOfTransactionIdIn(transactions.keySet()).stream()
                .collect(Collectors.toMap(PharmacyStockTransaction::getReversalOfTransactionId,
                        PharmacyStockTransaction::getId));
        Map<UUID, Long> latestOutflowSeqByAccount = latestOutflowSeqByAccount(accounts.keySet());

        return entries.stream().map(entry -> {
            PharmacyStockAccount account = accounts.get(entry.getStockAccountId());
            PharmacyStockTransaction transaction = transactions.get(entry.getTransactionId());
            return new LedgerRow(entry, account, products.get(account.getProductId()), transaction,
                    batches.get(account.getBatchId()), lookup(patientNames, transaction.getPatientId()),
                    lookup(supplierNames, transaction.getSupplierId()), reversalByOriginal.get(transaction.getId()),
                    isStockUsed(entry, transaction, account, latestOutflowSeqByAccount), null);
        }).toList();
    }

    // The same rule that blocks a reversal, so the Ledger can disable the
    // Reverse action up front instead of letting the pharmacist hit the error.
    private static boolean isStockUsed(PharmacyStockEntry entry, PharmacyStockTransaction transaction,
                                       PharmacyStockAccount account, Map<UUID, Long> latestOutflowSeqByAccount) {
        if (!ReversalRules.REVERSIBLE_TYPES.contains(transaction.getType())) {
            return false;
        }
        boolean outflowSince = latestOutflowSeqByAccount.getOrDefault(account.getId(), Long.MIN_VALUE) > entry.getSeq();
        return ReversalRules.isStockUsed(entry.getQuantityDelta(), account.getQuantity(), outflowSince);
    }

    private Map<UUID, Long> latestOutflowSeqByAccount(Set<UUID> accountIds) {
        return stockEntryRepository.findLatestOutflowByAccount(accountIds, ReversalRules.STOCK_OUTFLOW_TYPES).stream()
                .collect(Collectors.toMap(AccountOutflow::accountId, AccountOutflow::latestSeq));
    }

    private Map<UUID, String> patientNames(Set<UUID> patientIds) {
        return patientRepository.findAllById(patientIds).stream()
                .collect(Collectors.toMap(Patient::getId, patient -> patient.getFirstName() + " " + patient.getLastName()));
    }

    // Map.of() — the default supplier lookup — rejects null keys, and most
    // ledger rows have no patient or supplier.
    private static String lookup(Map<UUID, String> namesById, UUID id) {
        return id == null ? null : namesById.get(id);
    }

    private static <T> Set<UUID> ids(Collection<T> rows, Function<T, UUID> idOf) {
        return rows.stream().map(idOf).filter(Objects::nonNull).collect(Collectors.toSet());
    }

    private static <T> Map<UUID, T> byId(List<T> rows, Function<T, UUID> idOf) {
        return rows.stream().collect(Collectors.toMap(idOf, Function.identity()));
    }
}
