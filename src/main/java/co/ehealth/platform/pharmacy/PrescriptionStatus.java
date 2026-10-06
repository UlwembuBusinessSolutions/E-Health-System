package co.ehealth.platform.pharmacy;

// Shared between Prescription (a computed rollup of its items — never set
// directly, see Prescription.recomputeStatus()) and PrescriptionItem (the
// real, directly-set status; PARTIALLY_DISPENSED never applies to a single
// item, only to a prescription with a mix of item statuses).
public enum PrescriptionStatus {
    PENDING,
    DISPENSED,
    // The prescription/item itself is never deleted — this just records
    // that the pharmacy couldn't fill it (PrescriptionService.
    // markItemOutOfStock()), so the patient's record shows they didn't
    // actually collect the medicine. Not terminal: an item here can still
    // move to DISPENSED once stock is back.
    OUT_OF_STOCK,
    // Prescription-only: some items dispensed, some still pending (an
    // out-of-stock item alone, with nothing left pending, does NOT count —
    // see Prescription.recomputeStatus()).
    PARTIALLY_DISPENSED
}
