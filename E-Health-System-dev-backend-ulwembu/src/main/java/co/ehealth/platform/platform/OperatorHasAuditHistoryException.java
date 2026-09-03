package co.ehealth.platform.platform;

// PlatformOperatorService.delete()'s explicit rejection for an operator
// with existing platform_audit_log rows — the audit trail is never allowed
// to lose the identity of who did what (AUDT's own integrity requirement),
// so an operator who has ever logged in or performed a platform action
// can't be permanently removed, only disabled.
public class OperatorHasAuditHistoryException extends RuntimeException {
    public OperatorHasAuditHistoryException() {
        super("This operator has audit history and cannot be permanently deleted. Disable the account instead.");
    }
}
