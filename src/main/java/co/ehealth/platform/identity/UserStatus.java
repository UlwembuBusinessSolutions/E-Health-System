package co.ehealth.platform.identity;

// LOCKED is time-bound (AuthService auto-clears it after LOCKOUT_DURATION)
// rather than needing an admin to intervene.
public enum UserStatus {
    ACTIVE,
    LOCKED,
    DISABLED
}
