package co.ehealth.platform.patient;

// PatientService.get() — same shape as every other purpose-built
// NotFoundException in this codebase (OrganizationNotFoundException,
// PlatformOperatorNotFoundException).
public class PatientNotFoundException extends RuntimeException {
    public PatientNotFoundException() {
        super("Unknown patient");
    }
}
