package co.ehealth.platform.pharmacy.dispensing;

import java.time.LocalDate;
import java.util.UUID;

// One lot's AVAILABLE balance at one stock location. expiryDate is null for
// products that do not track expiry (they never count as expired).
public record LotAvailability(UUID facilityId, UUID productId, UUID batchId, UUID locationId, String lotNumber,
                               LocalDate expiryDate, long available) {

    // Same rule as PharmacyBatch.isExpiredAsOf(): usable through the printed
    // date, blocked from the following day.
    public boolean isExpiredAsOf(LocalDate today) {
        return expiryDate != null && expiryDate.isBefore(today);
    }
}
