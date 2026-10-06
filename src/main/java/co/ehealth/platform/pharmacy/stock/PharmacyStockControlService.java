package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.facility.FacilityNotFoundException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.LocalDate;
import java.util.*;

@Service
public class PharmacyStockControlService {
    private final FacilityRepository facilities;
    private final PharmacyStockAccountRepository accounts;
    private final PharmacyBatchRepository batches;
    private final PharmacyProductRepository products;
    private final PharmacyFacilityProductRepository assortment;
    private final PharmacyStockTransactionRepository transactions;
    private final PharmacyStockLedgerService ledger;
    private final AuditLogService audit;
    private final ObjectMapper mapper;
    private final Clock clock;

    public PharmacyStockControlService(FacilityRepository facilities, PharmacyStockAccountRepository accounts,
            PharmacyBatchRepository batches, PharmacyProductRepository products,
            PharmacyFacilityProductRepository assortment, PharmacyStockTransactionRepository transactions,
            PharmacyStockLedgerService ledger, AuditLogService audit, ObjectMapper mapper, Clock clock) {
        this.facilities = facilities; this.accounts = accounts; this.batches = batches; this.products = products;
        this.assortment = assortment; this.transactions = transactions; this.ledger = ledger;
        this.audit = audit; this.mapper = mapper; this.clock = clock;
    }

    public record CountCommand(UUID facilityId, UUID productId, UUID accountId, long expectedQuantity,
                               long countedQuantity, String reason) {}

    @Transactional
    public PharmacyStockTransaction count(CountCommand command, UUID requestId, UUID actor, String actorName) {
        lock(command.facilityId());
        String key = "count:" + requestId;
        String hash = hash(command);
        var replay = transactions.findByIdempotencyKey(key);
        if (replay.isPresent()) {
            if (!replay.get().getBodyHash().equals(hash)) throw new IdempotencyConflictException();
            return replay.get();
        }
        if (command.countedQuantity() < 0 || command.expectedQuantity() < 0
                || command.reason() == null || command.reason().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A non-negative count and a reason are required.");
        }
        var account = accounts.findAtFacility(command.facilityId(), command.productId()).stream()
                .filter(a -> a.getId().equals(command.accountId())).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Stock account not found at this clinic."));
        if (account.getQuantity() != command.expectedQuantity()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Stock changed during counting. Refresh and recount before posting.");
        }
        long delta = Math.subtractExact(command.countedQuantity(), account.getQuantity());
        var transaction = ledger.postEntries(delta < 0 ? StockTransactionType.ADJUSTMENT_NEGATIVE
                        : StockTransactionType.ADJUSTMENT_POSITIVE, command.facilityId(), actor, actorName,
                command.reason().trim(), "Stock count " + requestId, key, hash,
                List.of(new PharmacyStockLedgerService.EntryRequest(account.getProductId(), account.getBatchId(),
                        account.getLocationId(), account.getBucket(), delta)));
        // A zero variance is also a completed count and must retain who counted it and why.
        audit.append(actor, command.facilityId(), "STOCK_COUNT_POSTED", "PharmacyStockTransaction",
                transaction.getId().toString(), json(Map.of("quantity", command.expectedQuantity())), json(command));
        return transaction;
    }

    @Transactional
    public void updateReorderLevel(UUID facilityId, UUID productId, Integer threshold, UUID actor) {
        lock(facilityId);
        if (threshold != null && threshold < 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reorder level cannot be negative.");
        var item = assortment.findByProductIdAndFacilityId(productId, facilityId)
                .filter(PharmacyFacilityProduct::isActive).orElseThrow(ProductNotStockedAtFacilityException::new);
        String before = json(Collections.singletonMap("reorderThreshold", item.getReorderThreshold()));
        item.updateLevels(threshold, item.getTargetQuantity());
        assortment.save(item);
        audit.append(actor, facilityId, "STOCK_REORDER_LEVEL_CHANGED", "PharmacyFacilityProduct",
                item.getId().toString(), before, json(Collections.singletonMap("reorderThreshold", threshold)));
    }

    // Called inside PrescriptionService's transaction: failure rolls back stock, prescription status and audit.
    @Transactional
    public void dispense(UUID facilityId, UUID productId, int quantity, UUID prescriptionItemId,
                         UUID actor, String actorName) {
        lock(facilityId);
        if (productId == null || quantity <= 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select a stock product and a positive quantity.");
        var product = products.findById(productId).orElseThrow(PharmacyProductNotFoundException::new);
        if (!product.isActive()) throw new ProductArchivedException();
        assortment.findByProductIdAndFacilityId(productId, facilityId).filter(PharmacyFacilityProduct::isActive)
                .orElseThrow(ProductNotStockedAtFacilityException::new);
        Map<UUID, PharmacyBatch> batchById = new HashMap<>();
        batches.findByProductIdOrderByExpiryDateAsc(productId).forEach(b -> batchById.put(b.getId(), b));
        LocalDate today = LocalDate.now(clock);
        var eligible = accounts.findAtFacility(facilityId, productId).stream()
                .filter(a -> a.getBucket() == StockBucket.AVAILABLE && a.getQuantity() > 0)
                .filter(a -> {
                    var batch = batchById.get(a.getBatchId());
                    if (batch == null) return false;
                    var expiry = batch.getExpiryDate();
                    if (expiry != null && batch.getExpiryPrecision() == ExpiryPrecision.MONTH)
                        expiry = expiry.withDayOfMonth(expiry.lengthOfMonth());
                    return expiry == null ? !product.isExpiryTracked() : !expiry.isBefore(today);
                })
                .sorted(Comparator.<PharmacyStockAccount, LocalDate>comparing(
                        a -> batchById.get(a.getBatchId()).getExpiryDate(), Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(PharmacyStockAccount::getId)).toList();
        long remaining = quantity;
        List<PharmacyStockLedgerService.EntryRequest> entries = new ArrayList<>();
        for (var account : eligible) {
            long take = Math.min(remaining, account.getQuantity());
            if (take > 0) entries.add(new PharmacyStockLedgerService.EntryRequest(productId, account.getBatchId(),
                    account.getLocationId(), account.getBucket(), -take));
            remaining -= take;
            if (remaining == 0) break;
        }
        if (remaining != 0) throw new InsufficientStockException();
        ledger.postEntries(StockTransactionType.DISPENSE, facilityId, actor, actorName, "Prescription dispensing",
                prescriptionItemId.toString(), "dispense:" + prescriptionItemId,
                hash(List.of(facilityId, productId, quantity, prescriptionItemId)), entries);
    }

    private void lock(UUID facilityId) {
        facilities.lockForStock(facilityId).orElseThrow(FacilityNotFoundException::new);
    }

    private String json(Object value) {
        try { return mapper.writeValueAsString(value); }
        catch (com.fasterxml.jackson.core.JsonProcessingException e) { throw new IllegalStateException(e); }
    }

    private String hash(Object value) {
        try { return HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                .digest(json(value).getBytes(java.nio.charset.StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
