package co.ehealth.platform.patient;

// PatientMigrationService.migrate()/listDestinationFacilities() — the chosen
// destination organization doesn't exist, isn't ACTIVE, or is the caller's
// own organization. A client input problem, not a server error.
public class InvalidMigrationDestinationException extends RuntimeException {
    public InvalidMigrationDestinationException() {
        super("That destination isn't available to migrate a patient to.");
    }
}
