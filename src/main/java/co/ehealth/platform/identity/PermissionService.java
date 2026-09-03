package co.ehealth.platform.identity;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.core.tenant.ModuleCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class PermissionService {

    private final PermissionRepository permissionRepository;

    public PermissionService(PermissionRepository permissionRepository) {
        this.permissionRepository = permissionRepository;
    }

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

    public boolean hasAnyRole(String... roleNames) {
        Set<String> allowed = Set.of(roleNames);
        return currentRoleNames().stream().anyMatch(allowed::contains);
    }

    public void requireAnyRole(String... roleNames) {
        if (!hasAnyRole(roleNames)) {
            throw new NotAuthorizedException("This action is restricted to Admin and Reception staff.");
        }
    }

    private List<String> currentRoleNames() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
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
