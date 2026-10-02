package co.ehealth.platform.pharmacy.stock;

// PharmacyStockLedgerService.postEntries() — rule 7 of the plan's
// non-negotiable stock rules: "Lock/recheck balances; prohibit negative
// stock." Not reachable via Phase 1's receipt-only posting (every receipt
// entry is a positive delta), but the ledger service enforces this for
// every movement type, including the negative ones Phase 2/3 will add, so
// this exists from the start rather than being bolted on later.
public class InsufficientStockException extends RuntimeException {
    public InsufficientStockException() {
        super("This movement would take stock below zero.");
    }
}
