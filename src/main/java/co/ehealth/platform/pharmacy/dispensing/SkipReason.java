package co.ehealth.platform.pharmacy.dispensing;

// Why an item was left out of a hand-over instead of failing the whole
// collection.
public enum SkipReason {
    NOT_MAPPED("Choose the product to dispense this item from."),
    NO_USABLE_STOCK("No usable stock: nothing in date on the shelf."),
    INSUFFICIENT_STOCK("Not enough usable stock to hand over the full quantity."),
    NOT_PENDING("This item is not waiting to be dispensed.");

    private final String message;

    SkipReason(String message) {
        this.message = message;
    }

    public String message() {
        return message;
    }
}
