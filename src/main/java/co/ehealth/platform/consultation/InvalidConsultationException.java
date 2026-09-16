package co.ehealth.platform.consultation;

// ConsultationService's input validation — blank diagnosis text, a sign()
// call with no outcome selected, an amend()/markEnteredInError() call with
// no reason, or a diagnosisId that doesn't belong to the given
// consultation. A client input problem, not a server error, same shape as
// InvalidTriageCaptureException.
public class InvalidConsultationException extends RuntimeException {
    public InvalidConsultationException(String message) {
        super(message);
    }
}
