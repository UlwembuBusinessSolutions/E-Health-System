package co.ehealth.platform.platform;

// Same three states as identity.UserStatus: LOCKED is time-bound and
// self-clears, DISABLED is a deliberate deactivation that only another
// operator (or direct DB access, for the very first one) reverses.
public enum PlatformOperatorStatus {
    ACTIVE,
    LOCKED,
    DISABLED
}
