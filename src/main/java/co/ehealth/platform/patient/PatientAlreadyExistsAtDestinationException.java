package co.ehealth.platform.patient;

// PatientMigrationWriter.writeDestination() — the incoming idNumber already
// belongs to a patient at the destination that isn't eligible for automatic
// reactivation: either that record is still ACTIVE (id_number's own
// tenant-wide UNIQUE constraint guarantees a match can only be the same
// real person, so the destination already independently holds this exact
// person under a live record), or it's archived for a reason other than a
// prior migration out of this exact tenant (e.g. deceased, duplicate
// cleanup — Patient.reactivateFromMigration()'s own why-note on why only
// the migration case auto-reactivates). Either way, silently overwriting or
// merging into that record would be wrong — this needs a human to
// reconcile it, not another automatic write.
public class PatientAlreadyExistsAtDestinationException extends RuntimeException {
    public PatientAlreadyExistsAtDestinationException(String message) {
        super(message);
    }
}
