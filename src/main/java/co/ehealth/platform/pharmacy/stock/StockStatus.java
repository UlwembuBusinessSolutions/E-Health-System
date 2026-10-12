package co.ehealth.platform.pharmacy.stock;

// A product's shortage state at a facility (plan section 5): out when none
// is available, low when what is left is at or under its reorder threshold,
// otherwise in stock. A product with no threshold set is never "low" —
// positive availability is simply in stock.
public enum StockStatus {
    OUT("Out of stock"), LOW("Low stock"), IN_STOCK("In stock");

    private final String label;

    StockStatus(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public static StockStatus classify(long available, Integer reorderThreshold) {
        if (available <= 0) {
            return OUT;
        }
        if (reorderThreshold != null && available <= reorderThreshold) {
            return LOW;
        }
        return IN_STOCK;
    }
}
