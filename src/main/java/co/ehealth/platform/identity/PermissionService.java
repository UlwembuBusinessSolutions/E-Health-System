package co.ehealth.platform.identity;

// lihle | 2026-09-09 | Aligned staff roles and clinic assignments so permissions follow the current clinic context.

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.core.tenant.ModuleCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

// Evaluates module permissions using the current request's authorities.
// ClinicContextFilter refreshes those roles from clinic-scoped assignments;
// clinical repositories separately constrain records to the active clinic.
@Service
public class PermissionService {

    private final PermissionRepository permissionRepository;

    public PermissionService(PermissionRepository permissionRepository) {
        this.permissionRepository = permissionRepository;
    }

    // Throws rather than returning a boolean — every call site wants
    // exactly the same "403 and stop" behaviour (IAM-US-009 AC3), so there
    // is no legitimate caller that would want a silent false instead.
    public void requireAccess(ModuleCode module, PermissionLevel required) {
        if (!hasAccess(module, required)) {
            throw new NotAuthorizedException(module, required);
        }
    }

    public boolean hasAccess(ModuleCode module, PermissionLevel required) {
        List<String> roleNames = currentRoleNames();
        if (roleNames.isEmpty()) {
            return false;
        }
        Set<String> granted = new HashSet<>(permissionRepository.findCodesByRoleNames(roleNames));
        if (granted.contains(module.name() + ":MANAGE")) {
            return true;
        }
        return required == PermissionLevel.VIEW && granted.contains(module.name() + ":VIEW");
    }

    private List<String> currentRoleNames() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        // Not AuthenticatedPrincipal specifically — a platform operator's
        // principal type differs, and this method should simply see no
        // roles for one rather than risk a ClassCastException. In
        // practice, platform operators never reach a service that calls
        // this (they hold no tenant JWT, only X-Platform-Key), but this
        // guard is what makes that a fact this method doesn't have to
        // trust blindly.
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedPrincipal)) {
            return List.of();
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(authority -> authority.startsWith("ROLE_"))
                .map(authority -> authority.substring("ROLE_".length()))
                .toList();
    }
}
