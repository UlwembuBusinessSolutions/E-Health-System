package co.ehealth.platform.consultation;

// The clinician's "what happens next" choice at sign-off — mirrors the
// design brainstorm's four suggested outcomes exactly (§5). Recording an
// outcome here is purely the documented choice: SEND_TO_PHARMACY does not
// itself gate or release anything in Prescription/PrescriptionService —
// that wiring is out of scope for this slice.
public enum ConsultationOutcome {
    SEND_TO_PHARMACY, CONTINUE_INVESTIGATION, FINISH_NO_MEDICATION, REFER_OR_TRANSFER
}
