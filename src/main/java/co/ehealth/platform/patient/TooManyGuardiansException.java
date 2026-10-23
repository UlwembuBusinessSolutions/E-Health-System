package co.ehealth.platform.patient;

// PatientGuardianService.add()'s own cap — a receptionist adding a 6th
// guardian gets a clear rejection, not a silently-truncated list.
public class TooManyGuardiansException extends RuntimeException {
    public TooManyGuardiansException(int max) {
        super("A patient can have at most " + max + " guardians on file.");
    }
}
