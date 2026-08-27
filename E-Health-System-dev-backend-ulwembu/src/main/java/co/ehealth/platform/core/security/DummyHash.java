package co.ehealth.platform.core.security;

public final class DummyHash {
    // A real BCrypt hash of a random, never-used password — its only job
    // is to make a "not found" comparison cost the same CPU time as a real
    // one. Shared by AuthService and PasswordResetService.
    public static final String VALUE = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO4Wt3gCUAT7XZzTQZvKYY.hZ4gp8VvUq";

    private DummyHash() {
    }
}
