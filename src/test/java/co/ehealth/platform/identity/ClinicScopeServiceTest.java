package co.ehealth.platform.identity;

// lihle | 2026-09-09 | Updated regression coverage and fixtures to verify clinic isolation and clinical workflows.

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.clinic.ClinicAccessDeniedException;
import co.ehealth.platform.core.clinic.InvalidClinicScopeException;
import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ClinicScopeServiceTest {
    private final UUID actor = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();
    private final UUID a = UUID.randomUUID();
    private final UUID b = UUID.randomUUID();
    private final UserRepository users = mock(UserRepository.class);
    private final RoleRepository roles = mock(RoleRepository.class);
    private final FacilityService facilities = mock(FacilityService.class);
    private final AuditLogService audit = mock(AuditLogService.class);
    private final ClinicScopeService service = new ClinicScopeService(users, roles, facilities, audit, new ObjectMapper());

    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }

    @Test
    void singleClinicDefaultsAndRejectsUnassignedOrRevokedClinics() {
        when(users.findAccessibleClinicIds(userId)).thenReturn(List.of(a));
        assertThat(service.resolve(userId, null, null)).isEqualTo(a);
        assertThatThrownBy(() -> service.resolve(userId, a, b)).isInstanceOf(ClinicAccessDeniedException.class);
        when(users.findAccessibleClinicIds(userId)).thenReturn(List.of());
        assertThatThrownBy(() -> service.resolve(userId, a, a)).isInstanceOf(ClinicAccessDeniedException.class);
        assertThat(service.resolve(userId, a, null)).isNull();
    }

    @Test
    void multipleClinicsCanSwitchAndAmbiguousContextHasNoImplicitAccess() {
        when(users.findAccessibleClinicIds(userId)).thenReturn(List.of(a, b));
        assertThat(service.resolve(userId, a, b)).isEqualTo(b);
        assertThat(service.resolve(userId, a, null)).isEqualTo(a);
        assertThat(service.resolve(userId, null, null)).isNull();
    }

    @Test
    void nonAdministratorCannotChangeAssignments() {
        authenticate();
        assertThatThrownBy(() -> service.replaceAssignments(userId, List.of(a), a))
                .isInstanceOf(ClinicAccessDeniedException.class);
        verify(users, never()).removeFacilities(any());
    }

    @Test
    void administratorReplacesScopeAndAuditsTheChangeWithoutCopyingStrongerClinicRoles() {
        User user = adminAndUser();
        when(user.getFacilityId()).thenReturn(a);
        when(users.findAccessibleClinicIds(userId)).thenReturn(List.of(a, b));
        when(users.findRoleNamesInClinic(userId, a)).thenReturn(List.of("NURSE"));
        when(users.findRoleNamesInClinic(userId, b)).thenReturn(List.of("DOCTOR"));
        Role nurse = mock(Role.class);
        Role doctor = mock(Role.class);
        UUID nurseId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        when(nurse.getId()).thenReturn(nurseId);
        when(doctor.getId()).thenReturn(doctorId);
        when(roles.findByName("NURSE")).thenReturn(Optional.of(nurse));
        when(roles.findByName("DOCTOR")).thenReturn(Optional.of(doctor));
        active(a); active(b);
        assertThat(service.replaceAssignments(userId, List.of(a, b, a), b)).containsExactly(a, b);
        verify(users).removeFacilities(userId);
        verify(users).removeClinicRoles(userId);
        verify(users).assignRole(userId, nurseId, a);
        verify(users).assignRole(userId, doctorId, b);
        verify(users, never()).assignRole(userId, doctorId, a);
        verify(user).setFacilityId(b);
        verify(audit).append(eq(actor), isNull(), eq("USER_CLINIC_SCOPE_CHANGED"), eq("User"),
                eq(userId.toString()), contains(a.toString()), contains(b.toString()));
    }

    @Test
    void tenantWideRolesCannotSilentlyDefeatTheRestriction() {
        adminAndUser();
        when(users.findRoleNamesInClinic(userId, null)).thenReturn(List.of("ORG_ADMIN"));
        assertThatThrownBy(() -> service.replaceAssignments(userId, List.of(a), a))
                .isInstanceOf(InvalidClinicScopeException.class);
        verify(users, never()).removeClinicRoles(any());
    }

    @Test
    void inactiveClinicOrInvalidPrimaryDoesNotPartiallyChangeAssignments() {
        adminAndUser();
        assertThatThrownBy(() -> service.replaceAssignments(userId, List.of(a), b))
                .isInstanceOf(InvalidClinicScopeException.class);
        when(facilities.get(a)).thenReturn(mock(Facility.class));
        assertThatThrownBy(() -> service.replaceAssignments(userId, List.of(a), a))
                .isInstanceOf(InvalidClinicScopeException.class);
        verify(users, never()).removeFacilities(any());
    }

    private void authenticate() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AuthenticatedPrincipal(actor, "session"), null, List.of()));
    }

    private User adminAndUser() {
        authenticate();
        when(users.findRoleNamesInClinic(actor, null)).thenReturn(List.of("ORG_ADMIN"));
        User user = mock(User.class);
        when(users.findByIdForClinicUpdate(userId)).thenReturn(Optional.of(user));
        return user;
    }

    private void active(UUID id) {
        Facility facility = mock(Facility.class);
        when(facility.isActive()).thenReturn(true);
        when(facilities.get(id)).thenReturn(facility);
    }
}
