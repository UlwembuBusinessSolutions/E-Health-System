package co.ehealth.platform.visit;

// QueueService.issueManualToken() — the target visitId doesn't exist.
public class VisitNotFoundException extends RuntimeException {
    public VisitNotFoundException() {
        super("Unknown visit");
    }
}
