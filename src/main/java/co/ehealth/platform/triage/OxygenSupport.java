package co.ehealth.platform.triage;

// Required context for interpreting SpO2 — a "normal" reading on
// supplemental oxygen means something clinically different from the same
// number on room air. When SUPPLEMENTAL, TriageAssessment also records the
// delivery device and flow rate.
public enum OxygenSupport {
    ROOM_AIR,
    SUPPLEMENTAL
}
