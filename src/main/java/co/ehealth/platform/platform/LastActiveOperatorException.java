package co.ehealth.platform.platform;

// PlatformOperatorService.setEnabled()'s guard — thrown instead of disabling
// the last remaining ACTIVE operator. A platform-specific exception rather
// than reusing identity.LastRemainingAdminException (the tenant-side
// equivalent for ORG_ADMIN): the two concerns don't overlap — platform
// operators aren't tenant users — and PlatformAuthService's own precedent of
// reusing identity exceptions only applies to ones that genuinely carry no
// tenant-specific meaning (AccountLockedException, InvalidCredentialsException).
public class LastActiveOperatorException extends RuntimeException {
    public LastActiveOperatorException() {
        super("Cannot disable the last active platform operator.");
    }
}
