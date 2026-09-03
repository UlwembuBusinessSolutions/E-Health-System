package co.ehealth.platform.visit;

// Only the two states RECQ-US-001/002/004 actually need — the full state
// machine (InService/Completed/Cancelled/Stopped, RECQ-US-005) is Sprint 3,
// out of scope here.
public enum TokenStatus {
    ISSUED,
    CALLED
}
