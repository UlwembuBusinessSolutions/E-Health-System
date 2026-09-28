package co.ehealth.platform.patient;

// PatientMigrationService.getDestinationView() — this patient exists in the
// caller's own tenant (already confirmed by findById() before this is
// thrown) but was never migrated out, so there's no destination record for
// the "full ongoing access" view to reach. Same shape as PatientNotFoundException.
public class MigrationNotFoundException extends RuntimeException {
    public MigrationNotFoundException() {
        super("This patient was not migrated to another organization.");
    }
}
