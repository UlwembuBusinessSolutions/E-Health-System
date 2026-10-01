package co.ehealth.platform.visit;

// QueueService.transferToken() — the destination facility is the same one
// the token is already at. A client input problem, not a server error,
// same shape as InvalidQueueReasonException.
public class InvalidTransferException extends RuntimeException {
    public InvalidTransferException() {
        super("Can't transfer a ticket to the facility it's already at.");
    }
}
