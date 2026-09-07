package co.ehealth.platform.identity;

import co.ehealth.platform.core.tenant.ModuleCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Collection;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * IAM-US-009 Acceptance Criterion 3:
 * AC3: Given a role/module combination is marked no-access, When a user of that role
 *      calls the endpoint, Then they receive an explicit 403 rather than an empty
 *      result set.
 *
 * This test validates that PermissionService correctly throws NotAuthorizedException
 * (which results in a 403 HTTP response) when a user lacks permission for an operation.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Permission Enforcement - IAM-US-009 AC3")
class PermissionEnforcementTest {

    @Mock
    private PermissionRepository mockPermissionRepository;

    private PermissionService permissionService;

    @BeforeEach
    void setUp() {
        permissionService = new PermissionService(mockPermissionRepository);
    }

    @Test
    @DisplayName("AC3: NotAuthorizedException is thrown when role lacks MANAGE permission")
    void testManageAccessDeniedThrowsException() {
        // Setup: Pharmacist with PHRM:MANAGE only, trying to access PREG:MANAGE
        when(mockPermissionRepository.findCodesByRoleNames(List.of("Pharmacist")))
                .thenReturn(List.of("PREG:VIEW", "RECQ:VIEW", "PHRM:MANAGE"));

        setupSecurityContext("Pharmacist");

        assertThatThrownBy(() ->
                permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.MANAGE)
        )
                .isInstanceOf(NotAuthorizedException.class)
                .hasMessageContaining("manage")
                .hasMessageContaining("PREG");
    }

    @Test
    @DisplayName("AC3: NotAuthorizedException is thrown when role lacks VIEW permission")
    void testViewAccessDeniedThrowsException() {
        // Setup: Queue Marshall with no PHRM permission
        when(mockPermissionRepository.findCodesByRoleNames(List.of("Queue Marshall")))
                .thenReturn(List.of("RECQ:MANAGE", "APPT:VIEW", "PREG:VIEW"));

        setupSecurityContext("Queue Marshall");

        assertThatThrownBy(() ->
                permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW)
        )
                .isInstanceOf(NotAuthorizedException.class)
                .hasMessageContaining("view")
                .hasMessageContaining("Pharmacy");
    }

    @Test
    @DisplayName("AC3: Access NOT denied when user has the required permission")
    void testAccessGrantedDoesNotThrow() {
        // Setup: Pharmacist with PHRM:MANAGE
        when(mockPermissionRepository.findCodesByRoleNames(List.of("Pharmacist")))
                .thenReturn(List.of("PREG:VIEW", "RECQ:VIEW", "PHRM:MANAGE"));

        setupSecurityContext("Pharmacist");

        // Should not throw for MANAGE
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);

        // Should not throw for VIEW (MANAGE is superset)
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
    }

    @Test
    @DisplayName("AC3: MANAGE permission grants both MANAGE and VIEW access (superset)")
    void testManageIsViewSuperset() {
        // Setup: User with only MANAGE permission
        when(mockPermissionRepository.findCodesByRoleNames(List.of("Doctor")))
                .thenReturn(List.of("PHRM:MANAGE"));

        setupSecurityContext("Doctor");

        // MANAGE should grant both levels
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
    }

    @Test
    @DisplayName("AC3: hasAccess returns false for no-access combinations")
    void testHasAccessReturnsFalse() {
        // Setup: Social Worker with no pharmacy access
        when(mockPermissionRepository.findCodesByRoleNames(List.of("Social Worker")))
                .thenReturn(List.of("CASE:MANAGE", "CSMC:VIEW", "PREG:VIEW", "RECQ:VIEW", "CSOC:VIEW"));

        setupSecurityContext("Social Worker");

        boolean hasAccess = permissionService.hasAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        assertThat(hasAccess).isFalse();
    }

    @Test
    @DisplayName("AC3: hasAccess returns true for allowed combinations")
    void testHasAccessReturnsTrue() {
        // Setup: Social Worker with CASE:MANAGE
        when(mockPermissionRepository.findCodesByRoleNames(List.of("Social Worker")))
                .thenReturn(List.of("CASE:MANAGE", "CSMC:VIEW", "PREG:VIEW", "RECQ:VIEW", "CSOC:VIEW"));

        setupSecurityContext("Social Worker");

        // MANAGE permission should be granted
        boolean hasManage = permissionService.hasAccess(ModuleCode.CASE, PermissionLevel.MANAGE);
        assertThat(hasManage).isTrue();

        // VIEW should also be granted (MANAGE is superset)
        boolean hasView = permissionService.hasAccess(ModuleCode.CASE, PermissionLevel.VIEW);
        assertThat(hasView).isTrue();
    }

    @Test
    @DisplayName("AC3: Empty role list results in no access")
    void testNoRolesResultsInNoAccess() {
        // Setup: User with no roles
        when(mockPermissionRepository.findCodesByRoleNames(List.of()))
                .thenReturn(List.of());

        // Don't set up security context - it will have empty roles

        assertThatThrownBy(() ->
                permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.VIEW)
        )
                .isInstanceOf(NotAuthorizedException.class);
    }

    /**
     * Helper method to set up the Spring Security context with authorities.
     */
    private void setupSecurityContext(String roleName) {
        SecurityContext context = mock(SecurityContext.class);
        Authentication auth = mock(Authentication.class);

        // Mock authorities collection
        Collection<GrantedAuthority> authorities = List.of(
                new GrantedAuthority() {
                    @Override
                    public String getAuthority() {
                        return "ROLE_" + roleName;
                    }
                }
        );

        when(auth.getAuthorities()).thenReturn(authorities);
        when(context.getAuthentication()).thenReturn(auth);

        SecurityContextHolder.setContext(context);
    }
}
