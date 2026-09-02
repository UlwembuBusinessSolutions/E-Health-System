package co.ehealth.platform.patient;

public class PatientArchivedException extends RuntimeException {
    public PatientArchivedException() {
        super("This patient record is archived and cannot be edited.");
    }
}