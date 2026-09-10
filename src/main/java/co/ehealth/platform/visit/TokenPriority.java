package co.ehealth.platform.visit;

// Manual priority remains available for reception; TriageService also promotes
// Red and Orange assessments to this same queue priority.
public enum TokenPriority {
    NORMAL,
    PRIORITY
}
