package co.ehealth.platform.identity;

import co.ehealth.platform.core.audit.AuditDetails;
import co.ehealth.platform.core.audit.AuditLogService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

// Per-tenant role permission customisation (BR-IAM-020). Always runs against
// whichever tenant schema TenantContext currently points at, so a change
// here can only ever touch that one tenant's role_permissions rows — other
// tenants' same-named roles live in their own schemas. Callers are
// platform-operator flows (OrganizationProvisioningService), which set
// TenantContext before calling in, same as listAdmins()/removeAdmin().
@Service
public class RolePermissionService {

    // ORG_ADMIN is what every tenant uses to manage itself; stripping its
    // permissions could leave the org unable to recover. Not editable here.
    private static final String PROTECTED_ROLE = "ORG_ADMIN";

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final AuditLogService auditLogService;

    public RolePermissionService(RoleRepository roleRepository, PermissionRepository permissionRepository,
            AuditLogService auditLogService) {
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.auditLogService = auditLogService;
    }

    // One query per role — a tenant has ~13 roles, not enough to justify a
    // bulk join query of its own.
    @Transactional(readOnly = true)
    public RoleCatalogue catalogue() {
        List<RoleWithPermissions> roles = roleRepository.findAll().stream()
                .sorted(Comparator.comparing(Role::getName))
                .map(r -> new RoleWithPermissions(r.getId(), r.getName(), sortedCodes(r.getId())))
                .toList();
        List<String> available = permissionRepository.findAllCodes().stream().sorted().toList();
        return new RoleCatalogue(roles, available);
    }

    // Replaces the role's whole permission set. A no-op (identical set)
    // writes nothing and audits nothing.
    @Transactional
    public PermissionChange replacePermissions(UUID roleId, Collection<String> requestedCodes,
            UUID actingOperatorId) {
        Role role = roleRepository.findById(roleId).orElseThrow(RoleNotFoundException::new);
        if (PROTECTED_ROLE.equals(role.getName())) {
            throw new InvalidRolePermissionChangeException(
                    "The " + PROTECTED_ROLE + " role's permissions can't be customised.");
        }

        Set<String> desired = new TreeSet<>();
        for (String code : requestedCodes) {
            if (code == null || code.isBlank()) {
                throw new InvalidRolePermissionChangeException("Permission codes can't be blank.");
            }
            desired.add(code.trim());
        }
        Set<String> known = new HashSet<>(permissionRepository.findAllCodes());
        List<String> unknown = desired.stream().filter(c -> !known.contains(c)).toList();
        if (!unknown.isEmpty()) {
            throw new InvalidRolePermissionChangeException("Unknown permission code(s): " + unknown);
        }

        List<String> before = sortedCodes(roleId);
        List<String> after = new ArrayList<>(desired);
        if (before.equals(after)) {
            return new PermissionChange(role.getName(), before, after, false);
        }

        List<String> toRemove = before.stream().filter(c -> !desired.contains(c)).toList();
        List<String> toAdd = after.stream().filter(c -> !before.contains(c)).toList();
        if (!toRemove.isEmpty()) {
            permissionRepository.removeFromRole(roleId, toRemove);
        }
        if (!toAdd.isEmpty()) {
            permissionRepository.addToRole(roleId, toAdd);
        }

        // Tenant-side trail (jsonb before/after). userId is null: the actor
        // is a platform operator, who isn't a row in this tenant's users
        // table — their id travels in the after snapshot instead.
        auditLogService.append(null, null, "ROLE_PERMISSIONS_CUSTOMISED", "Role", roleId.toString(),
                AuditDetails.of("role", role.getName(), "permissions", before),
                AuditDetails.of("role", role.getName(), "permissions", after,
                        "changedByPlatformOperatorId", actingOperatorId.toString()));
        return new PermissionChange(role.getName(), before, after, true);
    }

    private List<String> sortedCodes(UUID roleId) {
        return permissionRepository.findCodesByRoleId(roleId).stream().sorted().collect(Collectors.toList());
    }

    public record RoleWithPermissions(UUID id, String name, List<String> permissionCodes) {
    }

    public record RoleCatalogue(List<RoleWithPermissions> roles, List<String> availablePermissions) {
    }

    public record PermissionChange(String roleName, List<String> before, List<String> after, boolean changed) {
    }
}