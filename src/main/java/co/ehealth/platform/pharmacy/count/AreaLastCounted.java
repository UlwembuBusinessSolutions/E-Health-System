package co.ehealth.platform.pharmacy.count;

import java.time.Instant;

// When an area (by its count scope label) was last counted and posted.
// Public because Hibernate instantiates it from the constructor expression
// in PharmacyStockCountRepository.latestPostedAreaCounts().
public record AreaLastCounted(String scopeLabel, Instant postedAt) {
}
