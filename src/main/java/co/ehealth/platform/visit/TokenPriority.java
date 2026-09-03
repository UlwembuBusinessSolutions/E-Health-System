package co.ehealth.platform.visit;

// RECQ-US-010's TEWS-based auto-priority (Red/Orange/Yellow/Green/Blue) is
// Sprint 3, out of scope here — this is the simpler manual flag reception
// staff can set at issuance (RECQ-US-001/002's own "priority" token field),
// ahead of any formal triage colour existing.
public enum TokenPriority {
    NORMAL,
    PRIORITY
}
