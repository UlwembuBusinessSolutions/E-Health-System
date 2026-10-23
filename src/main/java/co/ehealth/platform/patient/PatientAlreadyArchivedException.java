package co.ehealth.platform.patient;

// PatientService.archive()'s own guard — archiving is one-way (Patient's own
// why-note), so a second archive attempt is a caller error, not a silent
// no-op.
public class PatientAlreadyArchivedException extends RuntimeException {
    public PatientAlreadyArchivedException() {
        super("This patient record is already archived.");
    }
}
