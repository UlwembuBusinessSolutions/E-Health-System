package co.ehealth.platform.pharmacy.register;

// Why stock entered or left the register. Whether a kind adds or removes
// stock is fixed here so no caller can post, say, a "dispensed" entry that
// increases the balance.
public enum RegisterEntryKind {
    DISPENSED(false), RECEIVED(true), DESTROYED(false), LOST(false), RETURNED(true), OPENING(true);

    private final boolean incoming;

    RegisterEntryKind(boolean incoming) {
        this.incoming = incoming;
    }

    public boolean isIncoming() {
        return incoming;
    }

    public long balanceAfter(long balanceBefore, long quantity) {
        return incoming ? balanceBefore + quantity : balanceBefore - quantity;
    }
}
