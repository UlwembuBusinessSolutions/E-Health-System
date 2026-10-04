package co.ehealth.platform.pharmacy.reorder;

// The arithmetic behind the reorder page, free of any persistence so it can
// be read and tested on its own.
public final class ReorderSuggestion {

    private ReorderSuggestion() {
    }

    // Order enough to get back up to the target, rounded UP to whole packs
    // because suppliers sell packs, not loose units. Ordering a little more
    // than the target is acceptable; ordering less leaves the shelf short.
    // No target set (or already at/over it) means there is nothing to order.
    public static int suggestedQuantity(Integer targetQuantity, long onHand, Integer packSize) {
        if (targetQuantity == null || onHand >= targetQuantity) {
            return 0;
        }
        int shortfall = (int) (targetQuantity - onHand);
        if (packSize == null || packSize <= 1) {
            return shortfall;
        }
        int packsNeeded = (shortfall + packSize - 1) / packSize;
        return packsNeeded * packSize;
    }

    public static ReorderStatus statusOf(long onHand, Integer reorderThreshold) {
        if (onHand <= 0) {
            return ReorderStatus.OUT;
        }
        boolean atOrBelowThreshold = reorderThreshold != null && onHand <= reorderThreshold;
        return atOrBelowThreshold ? ReorderStatus.LOW : ReorderStatus.OK;
    }
}
