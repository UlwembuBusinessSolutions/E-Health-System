package co.ehealth.platform.visit;

// RECQ-US-005 + the out-and-back recall flow (queue-appointments-plan.md
// §3.4/§3.8): ISSUED -> CALLED -> COMPLETED is the normal path. CALLED ->
// MISSED covers a patient who didn't respond when called; [recall] moves a
// MISSED token straight back to ISSUED with its original priority and
// issuedAt untouched, so stepping out doesn't cost them their place.
// CANCELLED is reachable from ISSUED, CALLED, or MISSED and always carries
// a reason (QueueService.cancel()). IN_SERVICE/STOPPED (a consult
// interrupted partway through) aren't modelled yet — out of scope for this
// pass, see queue-system-improvements.md §3.
public enum TokenStatus {
    ISSUED,
    CALLED,
    MISSED,
    COMPLETED,
    CANCELLED
}
