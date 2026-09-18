package co.ehealth.platform.identity;

// lihle | 2026-09-09 | Added assigned-clinic context and access checks to prevent access outside a user's clinic scope.

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.clinic.ClinicAccessDeniedException;
import co.ehealth.platform.core.clinic.InvalidClinicScopeException;
import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.facility.FacilityService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

@Service
public class ClinicScopeService {
    private final UserRepository users;
    private final RoleRepository roles;
    private final FacilityService facilities;
    private final AuditLogService audit;
    private final ObjectMapper mapper;

    public ClinicScopeService(UserRepository users, RoleRepository roles, FacilityService facilities,
                              AuditLogService audit, ObjectMapper mapper) {
        this.users = users;
        this.roles = roles;
        this.facilities = facilities;
        this.audit = audit;
        this.mapper = mapper;
    }

    public List<UUID> accessibleClinics(UUID userId) { return users.findAccessibleClinicIds(userId); }

    public UUID resolve(UUID userId, UUID primaryClinicId, UUID requestedClinicId) {
        List<UUID> allowed = accessibleClinics(userId);
        if (requestedClinicId != null) {
            if (!allowed.contains(requestedClinicId)) {
                throw new ClinicAccessDeniedException("You are not assigned to this active clinic.");
            }
            return requestedClinicId;
        }
        if (primaryClinicId != null && allowed.contains(primaryClinicId)) { return primaryClinicId; }
        return allowed.size() == 1 ? allowed.get(0) : null;
    }

    public List<String> rolesInClinic(UUID userId, UUID clinicId) {
        return users.findRoleNamesInClinic(userId, clinicId);
    }

    public AssignmentView assignments(UUID userId) {
        requireAdmin();
        User user = users.findById(userId).orElseThrow(() -> new InvalidClinicScopeException("Unknown staff member"));
        return new AssignmentView(user.getFacilityId(), users.findAssignedClinicIds(userId),
                !users.findRoleNamesInClinic(userId, null).isEmpty());
    }

    public record AssignmentView(UUID primaryClinicId, List<UUID> clinicIds, boolean tenantWide) { }

    @Transactional
    public List<UUID> replaceAssignments(UUID userId, List<UUID> clinicIds, UUID primaryClinicId) {
        AuthenticatedPrincipal actor = requireAdmin();
        User user = users.findByIdForClinicUpdate(userId)
                .orElseThrow(() -> new InvalidClinicScopeException("Unknown staff member"));
        List<UUID> clinics = clinicIds.stream().distinct().toList();
        if (clinics.isEmpty() || !clinics.contains(primaryClinicId)) {
            throw new InvalidClinicScopeException("The primary clinic must be included in the assigned clinics.");
        }
        // Tenant-wide roles deliberately retain organization-wide access. Do not silently narrow an admin.
        if (!users.findRoleNamesInClinic(userId, null).isEmpty()) {
            throw new InvalidClinicScopeException("Remove tenant-wide role assignments before restricting this user.");
        }
        for (UUID clinic : clinics) {
            if (!facilities.get(clinic).isActive()) {
                throw new InvalidClinicScopeException("Only active clinics can be assigned.");
            }
        }
        List<String> primaryRoles = rolesInClinic(userId, user.getFacilityId());
        var assignments = new java.util.LinkedHashMap<UUID, List<UUID>>();
        for (UUID clinic : clinics) {
            List<String> names = rolesInClinic(userId, clinic);
            // Preserve existing clinic-specific permissions; newly assigned clinics inherit the primary role set.
            if (names.isEmpty()) { names = primaryRoles; }
            if (names.isEmpty()) { throw new InvalidClinicScopeException("The user must have a primary clinic role."); }
            assignments.put(clinic, names.stream().distinct()
                    .map(name -> roles.findByName(name).orElseThrow().getId()).toList());
        }
        String before = snapshot(accessibleClinics(userId), user.getFacilityId());
        users.removeClinicRoles(userId);
        users.removeFacilities(userId);
        for (UUID clinic : clinics) {
            users.assignFacility(userId, clinic);
            for (UUID role : assignments.get(clinic)) { users.assignRole(userId, role, clinic); }
        }
        user.setFacilityId(primaryClinicId);
        audit.append(actor.userId(), null, "USER_CLINIC_SCOPE_CHANGED", "User", userId.toString(),
                before, snapshot(clinics, primaryClinicId));
        return clinics;
    }

    private String snapshot(List<UUID> clinics, UUID primary) {
        try { return mapper.writeValueAsString(new ScopeSnapshot(clinics, primary)); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Could not serialize clinic scope", e); }
    }

    private AuthenticatedPrincipal requireAdmin() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedPrincipal actor)
                || !users.findRoleNamesInClinic(actor.userId(), null).contains("ORG_ADMIN")) {
            throw new ClinicAccessDeniedException("Only a tenant administrator may manage clinic assignments.");
        }
        return actor;
    }

    private record ScopeSnapshot(List<UUID> clinicIds, UUID primaryClinicId) { }
}
