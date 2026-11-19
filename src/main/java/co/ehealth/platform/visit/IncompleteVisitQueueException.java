package co.ehealth.platform.visit;

public class IncompleteVisitQueueException extends RuntimeException {
    public IncompleteVisitQueueException() {
        super("This patient already has a queue visit that is not completed. Continue care using the existing visit; a new visit can only be started after its token is completed.");
    }
}
