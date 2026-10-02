package co.ehealth.platform.visit;

// QueueService's token-transition methods (markMissed/recall/complete/
// cancel) — the target tokenId doesn't exist.
public class QueueTokenNotFoundException extends RuntimeException {
    public QueueTokenNotFoundException() {
        super("Unknown queue token");
    }
}
