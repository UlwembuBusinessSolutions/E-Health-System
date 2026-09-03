package co.ehealth.platform.visit;

// PREG-US-019's "visit type to service stream mapping" — the backlog
// doesn't spell out the actual stream taxonomy anywhere, so this borrows
// the app's own existing clinical-module names (ModuleCode's own CSAC/CSCC/
// CSMC/OCCH) rather than inventing an unrelated one: a visit's service
// stream is naturally "which of these modules this encounter belongs to."
public enum ServiceStream {
    GENERAL,
    CHRONIC_CARE,
    MATERNAL_CHILD,
    OCCUPATIONAL_HEALTH
}
