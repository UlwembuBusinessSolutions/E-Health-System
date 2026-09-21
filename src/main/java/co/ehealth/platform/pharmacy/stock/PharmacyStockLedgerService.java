package co.ehealth.platform.pharmacy.stock;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

// The one place quantity ever changes — plan section 7's posting engine.
// Every movement type (Phase 1's RECEIPT/OPENING_BALANCE, and every later
// ADJUSTMENT/HOLD/RELEASE/WRITE_OFF/REVERSAL/DISPENSE/TRANSFER_*) posts
// through postEntries() below; no controller or other service is allowed
// to touch a PharmacyStockAccount's quantity directly (PharmacyStockAccount.
// applyDelta()'s own why-note). Callers resolve product/batch/location ids
// themselves first (PharmacyReceiptService does this for receiving) — this
// service only ever moves quantity between already-identified accounts.
@Service
public class PharmacyStockLedgerService {

    private final PharmacyStockAccountRepository stockAccountRepository;
    private final PharmacyStockTransactionRepository stockTransactionRepository;
    private final PharmacyStockEntryRepository stockEntryRepository;
    private final Clock clock;

    public PharmacyStockLedgerService(PharmacyStockAccountRepository stockAccountRepository,
                                       PharmacyStockTransactionRepository stockTransactionRepository,
                                       PharmacyStockEntryRepository stockEntryRepository, Clock clock) {
        this.stockAccountRepository = stockAccountRepository;
        this.stockTransactionRepository = stockTransactionRepository;
        this.stockEntryRepository = stockEntryRepository;
        this.clock = clock;
    }

    // One line to post — a signed delta against one (product, batch,
    // location, bucket) account. quantityDelta is already signed by the
    // caller (positive for a receipt, negative for a future dispense/
    // write-off); this service derives nothing about direction from `type`
    // itself, it only records `type` for the transaction's own audit trail.
    public record EntryRequest(UUID productId, UUID batchId, UUID locationId, StockBucket bucket, long quantityDelta) {
    }

    // Returns the ORIGINAL transaction, not a fresh one, when idempotencyKey
    // already exists with a matching bodyHash — plan section 7, STK-10: "a
    // retried request with the same key/body returns the original result."
    // A reused key with a different bodyHash is rejected (IdempotencyConflictException)
    // rather than silently posting a second, different movement under the
    // same key.
    @Transactional
    public PharmacyStockTransaction postEntries(StockTransactionType type, UUID facilityId, UUID actorUserId,
                                                 String actorName, String reason, String sourceReference,
                                                 String idempotencyKey, String bodyHash,
                                                 List<EntryRequest> entryRequests) {
        Optional<PharmacyStockTransaction> existing = stockTransactionRepository.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) {
            if (!existing.get().getBodyHash().equals(bodyHash)) {
                throw new IdempotencyConflictException();
            }
            return existing.get();
        }

        PharmacyStockTransaction transaction = stockTransactionRepository.save(new PharmacyStockTransaction(
                type, facilityId, actorUserId, actorName, reason, sourceReference, idempotencyKey, bodyHash, null,
                clock.instant()));

        // Deterministic lock order — every caller posting against an
        // overlapping set of accounts acquires locks in the same
        // (product, batch, location, bucket) order, so two concurrent
        // postings can never deadlock against each other (plan section 7
        // step 3's own requirement).
        List<EntryRequest> ordered = entryRequests.stream()
                .sorted(Comparator.<EntryRequest, UUID>comparing(EntryRequest::productId)
                        .thenComparing(EntryRequest::batchId)
                        .thenComparing(EntryRequest::locationId)
                        .thenComparing(er -> er.bucket().name()))
                .toList();

        List<PharmacyStockEntry> entries = new ArrayList<>();
        for (EntryRequest entryRequest : ordered) {
            stockAccountRepository.ensureAccountExists(entryRequest.productId(), entryRequest.batchId(),
                    entryRequest.locationId(), entryRequest.bucket().name());
            PharmacyStockAccount account = stockAccountRepository.findForUpdate(entryRequest.productId(),
                            entryRequest.batchId(), entryRequest.locationId(), entryRequest.bucket())
                    .orElseThrow(() -> new IllegalStateException("Stock account missing immediately after creation"));

            long before = account.getQuantity();
            long after = before + entryRequest.quantityDelta();
            if (after < 0) {
                throw new InsufficientStockException();
            }
            account.applyDelta(entryRequest.quantityDelta());

            entries.add(new PharmacyStockEntry(transaction.getId(), account.getId(), entryRequest.quantityDelta(),
                    before, after, clock.instant()));
        }
        stockEntryRepository.saveAll(entries);

        return transaction;
    }
}
