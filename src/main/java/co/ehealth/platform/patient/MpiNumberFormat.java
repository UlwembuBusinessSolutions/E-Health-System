package co.ehealth.platform.patient;

// Shared between PatientService.register() and PatientMigrationWriter's
// destination-side write — both mint a brand-new MPI from a tenant code plus
// that tenant's own patient_mpi_seq value, and both need to agree on the
// exact same format for it to mean anything (e.g. "DC-0000038"). Existing
// pre-migration-feature MPIs ("MPI-0000038") are untouched — Patient.mpiNumber
// has no setter, so every already-persisted row is already immutable; only
// the format used for brand-new rows changes here.
final class MpiNumberFormat {

    private MpiNumberFormat() {
    }

    static String generate(String tenantCode, long sequenceValue) {
        return "%s-%07d".formatted(tenantCode, sequenceValue);
    }
}
