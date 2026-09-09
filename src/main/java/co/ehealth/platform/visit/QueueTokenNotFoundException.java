package co.ehealth.platform.visit;

// QueueService.transferToken() — the target token does not exist.
public class QueueTokenNotFoundException extends RuntimeException {
    public QueueTokenNotFoundException() {
        super("Unknown queue token");
    }
}
