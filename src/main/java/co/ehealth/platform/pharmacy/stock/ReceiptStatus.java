package co.ehealth.platform.pharmacy.stock;

// PharmacyReceipt.status is always POSTED in Phase 1 — DRAFT/CANCELLED
// exist for the later persisted, resumable draft-receiving lifecycle the
// plan describes (section 8); Phase 1's "review before posting" is a
// client-side confirmation step before one atomic POST, not a server-side
// draft someone can save and reopen (documented simplification,
// pharmacy-stock-ledger-context.md's delivery-order note).
public enum ReceiptStatus {
    DRAFT, POSTED, CANCELLED
}
