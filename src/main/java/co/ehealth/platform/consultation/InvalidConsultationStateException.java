package co.ehealth.platform.consultation;

// A lifecycle-state conflict rather than bad input: editing/adding-or-
// removing-a-diagnosis on a consultation that is no longer DRAFT, or
// amending/entering-in-error one that isn't currently SIGNED. The request
// is well-formed, it just can't happen against this record's current
// state — same "conflicts with current state" reasoning as
// PrescriptionAlreadyDispensedException.
public class InvalidConsultationStateException extends RuntimeException {
    public InvalidConsultationStateException(String message) {
        super(message);
    }
}
