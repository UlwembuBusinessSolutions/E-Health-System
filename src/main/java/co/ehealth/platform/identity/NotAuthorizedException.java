package co.ehealth.platform.identity;

import co.ehealth.platform.core.tenant.ModuleCode;

// IAM-US-009's own explicit-denial requirement (AC3): a role/module
// combination with no permission gets a real 403 here, never a silently
// empty list or a 404 that could be confused with "doesn't exist" — the
// FRS's own error-code table (Section 3.2) draws that same distinction
// between NOT_AUTHORISED and NOT_FOUND.
public class NotAuthorizedException extends RuntimeException {
    public NotAuthorizedException(ModuleCode module, PermissionLevel required) {
        super("Your role doesn't have %s access to %s.".formatted(
                required == PermissionLevel.MANAGE ? "manage" : "view", module.getDisplayName()));
    }

    public NotAuthorizedException(String message) {
        super(message);
    }
}
