package co.ehealth.platform.visit;

// One entry per kind of thing QueueService actually does to a token.
// CALLED_OUT_OF_ORDER is distinct from CALLED — same status transition,
// but only the former ever carries a reason, since it's the one that
// needed staff to justify skipping ahead of the normal queue order.
// TRANSFERRED_OUT/TRANSFERRED_IN are the same pattern applied to
// QueueService.transferToken(): the origin token's event is a CANCELLED
// transition and the destination token's is an ISSUED one, same as any
// other cancel/issue, but tagged distinctly so a token's history reads as
// "sent to Facility X" rather than an unexplained cancellation.
public enum QueueTokenEventType {
    ISSUED,
    CALLED,
    CALLED_OUT_OF_ORDER,
    MISSED,
    REACTIVATED,
    COMPLETED,
    CANCELLED,
    PRIORITY_CHANGED,
    TRANSFERRED_OUT,
    TRANSFERRED_IN
}
