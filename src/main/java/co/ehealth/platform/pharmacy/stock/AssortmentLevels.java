package co.ehealth.platform.pharmacy.stock;

import java.util.UUID;

// New reorder/target levels for one product at one facility, as sent with a
// product edit. facilityId null means the edit carries no level changes.
public record AssortmentLevels(UUID facilityId, Integer reorderThreshold, Integer targetQuantity) {

    public static final AssortmentLevels NONE = new AssortmentLevels(null, null, null);

    boolean isPresent() {
        return facilityId != null;
    }
}
