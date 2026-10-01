package co.ehealth.platform.pharmacy;

// Shared by prescription items and the prescription rollup.
public enum PrescriptionStatus {
    PENDING,
    DECLINED,
    DISPENSED,
    // The prescription/item itself is never deleted — this just records
    // that the pharmacy couldn't fill it (PrescriptionService.
    // markItemOutOfStock()), so the patient's record shows they didn't
    // actually collect the medicine. Not terminal: an item here can still
    // move to DISPENSED once stock is back.
    OUT_OF_STOCK,
    // Some prescribed quantity remains to be supplied.
    PARTIALLY_DISPENSED
}
