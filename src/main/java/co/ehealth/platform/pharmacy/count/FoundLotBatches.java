package co.ehealth.platform.pharmacy.count;

import co.ehealth.platform.pharmacy.stock.BatchExpiryConflictException;
import co.ehealth.platform.pharmacy.stock.ExpiryPrecision;
import co.ehealth.platform.pharmacy.stock.PharmacyBatch;
import co.ehealth.platform.pharmacy.stock.PharmacyBatchRepository;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;

// A found lot is stock on the shelf that the ledger has no lot for. The
// lot is checked when it is added (so the counter hears about a clash
// immediately) and only created at posting (so a discarded draft leaves no
// stray batch behind).
@Component
class FoundLotBatches {

    private final PharmacyBatchRepository batchRepository;
    private final Clock clock;

    FoundLotBatches(PharmacyBatchRepository batchRepository, Clock clock) {
        this.batchRepository = batchRepository;
        this.clock = clock;
    }

    void assertNoExpiryConflict(UUID productId, String lotNumber, LocalDate expiryDate) {
        batchRepository.findMatching(productId, null, lotNumber)
                .filter(existing -> !expiryDate.equals(existing.getExpiryDate()))
                .ifPresent(existing -> {
                    throw new BatchExpiryConflictException(lotNumber);
                });
    }

    // Reuses the lot when the ledger already knows it with the same expiry
    // (a zero-balance lot being found again), otherwise creates it.
    PharmacyBatch resolveOrCreate(PharmacyStockCountLine foundLine, UUID actorUserId, String actorName) {
        assertNoExpiryConflict(foundLine.getProductId(), foundLine.getLotNumber(), foundLine.getExpiryDate());
        return batchRepository.findMatching(foundLine.getProductId(), null, foundLine.getLotNumber())
                .orElseGet(() -> batchRepository.save(new PharmacyBatch(foundLine.getProductId(), null,
                        foundLine.getLotNumber(), foundLine.getExpiryDate(), ExpiryPrecision.DAY,
                        foundLine.getExpiryDate().toString(), actorUserId, actorName, clock.instant())));
    }
}
