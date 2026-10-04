package co.ehealth.platform.pharmacy.receiving;

import co.ehealth.platform.pharmacy.stock.BatchExpiryConflictException;
import co.ehealth.platform.pharmacy.stock.ExpiryPrecision;
import co.ehealth.platform.pharmacy.stock.PharmacyBatch;
import co.ehealth.platform.pharmacy.stock.PharmacyBatchRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;

// Finds or creates the lot a quantity is posted against. Shared by receiving
// and opening stock so both apply the same lot rules.
//
// Untracked products (batchTracked = false) always resolve to one canonical
// "N/A" lot per product — every stock account still needs a non-null batch id
// (V35's own why-note), this is just never shown as a real batch to the
// user. Tracked products resolve/create a real lot by (product,
// manufacturer, lotNumber), rejecting a conflicting expiry on an existing lot
// rather than silently accepting it (plan section 6, STK-06).
@Component
public class PharmacyBatchResolver {

    private final PharmacyBatchRepository batchRepository;
    private final Clock clock;

    public PharmacyBatchResolver(PharmacyBatchRepository batchRepository, Clock clock) {
        this.batchRepository = batchRepository;
        this.clock = clock;
    }

    public PharmacyBatch resolve(PharmacyProduct product, String manufacturer, String lotNumber,
                                 LocalDate expiryDate, ExpiryPrecision expiryPrecision, UUID actorUserId,
                                 String actorName) {
        if (!product.isBatchTracked()) {
            return batchRepository.findMatching(product.getId(), null, "N/A")
                    .orElseGet(() -> batchRepository.save(new PharmacyBatch(product.getId(), null, "N/A", null, null,
                            null, actorUserId, actorName, clock.instant())));
        }
        var existing = batchRepository.findMatching(product.getId(), manufacturer, lotNumber);
        if (existing.isPresent()) {
            return requireSameExpiry(existing.get(), expiryDate, lotNumber);
        }
        String printedExpiry = expiryDate != null ? expiryDate.toString() : null;
        return batchRepository.save(new PharmacyBatch(product.getId(), manufacturer, lotNumber, expiryDate,
                expiryPrecision, printedExpiry, actorUserId, actorName, clock.instant()));
    }

    private PharmacyBatch requireSameExpiry(PharmacyBatch batch, LocalDate expiryDate, String lotNumber) {
        boolean expiryMatches = batch.getExpiryDate() == null ? expiryDate == null
                : batch.getExpiryDate().equals(expiryDate);
        if (!expiryMatches) {
            throw new BatchExpiryConflictException(lotNumber);
        }
        return batch;
    }
}
