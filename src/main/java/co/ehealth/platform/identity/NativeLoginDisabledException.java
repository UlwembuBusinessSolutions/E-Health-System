package co.ehealth.platform.identity;

public class NativeLoginDisabledException extends RuntimeException {
    public NativeLoginDisabledException() {
        super("Native login is disabled for this tenant. Use single sign-on.");
    }
}
