package co.ehealth.platform.visit;

// QueueService.callNext() — nothing ISSUED to call at this facility. A
// client-facing state (a queue marshall clicking "call next" on an empty
// queue), not a server error.
public class EmptyQueueException extends RuntimeException {
    public EmptyQueueException() {
        super("The queue is empty — there's no one waiting to be called.");
    }
}
