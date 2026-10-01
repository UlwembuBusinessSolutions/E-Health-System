package co.ehealth.platform.consultation;

// UNKNOWN ("hasn't been asked yet") is deliberately distinct from
// NONE_KNOWN ("asked, patient reports none") — defaulting a blank answer to
// NONE_KNOWN would silently misrepresent "never asked" as "confirmed
// safe," per the vitals-to-consultation brainstorm's own explicit warning
// (Docs/vitals-to-consultation-pharmacy-closure-brainstorm.md §5).
public enum AllergyStatus {
    UNKNOWN, NONE_KNOWN, KNOWN
}
