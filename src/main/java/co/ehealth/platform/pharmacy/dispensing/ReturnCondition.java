package co.ehealth.platform.pharmacy.dispensing;

// Why a returned unit went back on the shelf or to waste. UNOPENED and
// WRONG_ITEM are safe to restock; DAMAGED never goes back on the shelf.
public enum ReturnCondition {
    UNOPENED, DAMAGED, WRONG_ITEM;

    public boolean isRestockable() {
        return this != DAMAGED;
    }
}
