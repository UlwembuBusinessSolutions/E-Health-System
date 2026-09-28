package co.ehealth.platform.patient;

// PREG-US-018 AC2: "an archived record... every edit control is disabled."
// Thrown by any mutation that would otherwise change an archived patient's
// own record or its attached documents/guardians — reading an archived
// patient is always still allowed (PatientService.get() has no such guard).
public class PatientArchivedException extends RuntimeException {
    public PatientArchivedException() {
        super("This patient record is archived and cannot be edited.");
    }
}
