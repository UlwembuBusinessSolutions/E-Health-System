package co.ehealth.platform.triage;

// TriageService's capture-time validation — an emergency-sign capture
// without a note, a non-emergency ADULT capture missing a required vital,
// or a correction that targets an assessment that isn't ACTIVE / doesn't
// belong to the visit it claims to. A client input problem, not a server
// error, same shape as InvalidQueueReasonException.
public class InvalidTriageCaptureException extends RuntimeException {
    public InvalidTriageCaptureException(String message) {
        super(message);
    }
}
