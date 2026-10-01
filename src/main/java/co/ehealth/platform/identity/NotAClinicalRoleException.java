package co.ehealth.platform.identity;

// PermissionService.requireAnyRole()'s own why-note — thrown when the
// acting user holds a module permission (RECQ:MANAGE, typically) but not
// one of the specific clinical roles a particular action additionally
// requires. Same shape as NotAuthorizedException (a role/action mismatch,
// not a missing resource), kept separate because the message needs to
// name specific roles rather than a module + VIEW/MANAGE level.
public class NotAClinicalRoleException extends RuntimeException {
    public NotAClinicalRoleException(String message) {
        super(message);
    }
}
