package co.ehealth.platform.visit;

public class QueueTokenAlreadyLinkedException extends RuntimeException {
    public QueueTokenAlreadyLinkedException() {
        super("This queue token is already linked to another patient.");
    }
}
