package co.ehealth.platform.patient;

// Own enum rather than reusing identity.UserStatus — same precedent
// platform.PlatformOperatorStatus already set: each identity space (staff,
// platform operator, patient) owns its own status enum even though the
// three values are identical, so none of them accidentally couples to the
// others' lifecycle rules.
public enum PatientAccountStatus {
    ACTIVE,
    LOCKED,
    DISABLED
}
