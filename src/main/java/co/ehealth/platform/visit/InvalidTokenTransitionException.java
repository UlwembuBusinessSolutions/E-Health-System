package co.ehealth.platform.visit;

// QueueToken's own transition guards (markMissed/recall/complete/cancel) —
// thrown when the token's current status doesn't allow the requested move
// (e.g. recalling a token that was never MISSED, or completing one that
// was never CALLED). A client timing/input problem, not a server error —
// same "conflicts with current state" shape as EmptyQueueException.
public class InvalidTokenTransitionException extends RuntimeException {
    public InvalidTokenTransitionException(TokenStatus from, TokenStatus to) {
        super("Can't move a token from " + from + " to " + to + ".");
    }

    // QueueToken.updatePriority() — the token itself isn't changing status,
    // it's just too far along (COMPLETED/CANCELLED) for a priority change
    // to mean anything.
    public InvalidTokenTransitionException(TokenStatus current) {
        super("Can't change priority on a token that's already " + current + ".");
    }
}
