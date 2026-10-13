package co.ehealth.platform.identity;

public class RoleNotFoundException extends RuntimeException {
    public RoleNotFoundException() {
        super("Unknown role");
    }
}