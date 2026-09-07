package co.ehealth.platform.identity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * IAM-US-009 Acceptance Criterion 1 & 2:
 * AC1: Given a new tenant is created, Then all 13 baseline roles are seeded
 *      with the permission sets defined in the BRD RBAC matrix.
 * AC2: Given I inspect any role, Then its module-by-module permissions match
 *      the published matrix.
 *
 * This test validates the baseline roles seeding via database migrations
 * and verifies the RBAC matrix against the published specification.
 */
@DataJpaTest
@Import({RoleRepository.class, PermissionRepository.class})
@DisplayName("RBAC Matrix Validation - IAM-US-009 AC1/AC2")
class RbacMatrixValidationTest {

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PermissionRepository permissionRepository;

    // The 13 baseline roles per the FRS and BRD matrix
    private static final Set<String> BASELINE_ROLES = Set.of(
            "ORG_ADMIN",
            "Facility Manager",
            "Admin Staff",
            "Doctor",
            "Professional Nurse",
            "Clinician",
            "Pharmacist",
            "Queue Marshall",
            "Social Worker",
            "Compliance Officer",
            "Reporting Analyst",
            "Billing Administrator",
            "Occupational Health Practitioner"
    );

    // Published RBAC matrix: role -> permissions
    private static final Map<String, Set<String>> EXPECTED_MATRIX = Map.ofEntries(
            Map.entry("ORG_ADMIN", Set.of(
                    "SADM:MANAGE", "AUDT:MANAGE", "IAM:MANAGE", "PREG:MANAGE", "RECQ:MANAGE",
                    "APPT:MANAGE", "PHRM:MANAGE", "BIOM:MANAGE", "CSAC:MANAGE", "CSCC:MANAGE",
                    "CSMC:MANAGE", "RPTA:MANAGE", "MHWA:MANAGE", "OCCH:MANAGE", "CASE:MANAGE",
                    "ASMT:MANAGE", "TELE:MANAGE", "PBIL:MANAGE", "MENV:MANAGE", "CSOC:MANAGE"
            )),
            Map.entry("Facility Manager", Set.of(
                    "AUDT:VIEW", "PREG:VIEW", "RECQ:MANAGE", "APPT:MANAGE", "PHRM:VIEW",
                    "BIOM:VIEW", "CSAC:VIEW", "CSCC:VIEW", "CSMC:VIEW", "OCCH:VIEW",
                    "RPTA:VIEW", "MHWA:VIEW", "CASE:VIEW", "ASMT:VIEW", "TELE:VIEW",
                    "MENV:VIEW", "CSOC:VIEW"
            )),
            Map.entry("Admin Staff", Set.of(
                    "PREG:MANAGE", "RECQ:MANAGE", "APPT:MANAGE", "BIOM:MANAGE"
            )),
            Map.entry("Doctor", Set.of(
                    "PREG:VIEW", "RECQ:MANAGE", "APPT:VIEW", "PHRM:MANAGE", "BIOM:VIEW",
                    "CSAC:MANAGE", "CSCC:MANAGE", "CSMC:MANAGE", "OCCH:MANAGE", "CASE:MANAGE",
                    "ASMT:MANAGE", "TELE:MANAGE", "RPTA:VIEW", "MHWA:VIEW", "MENV:VIEW",
                    "CSOC:VIEW"
            )),
            Map.entry("Professional Nurse", Set.of(
                    "PREG:VIEW", "RECQ:MANAGE", "APPT:VIEW", "PHRM:MANAGE", "BIOM:VIEW",
                    "CSAC:MANAGE", "CSCC:MANAGE", "CSMC:MANAGE", "OCCH:MANAGE", "CASE:MANAGE",
                    "ASMT:MANAGE", "TELE:MANAGE", "RPTA:VIEW", "MHWA:VIEW", "MENV:VIEW",
                    "CSOC:VIEW"
            )),
            Map.entry("Clinician", Set.of(
                    "PREG:VIEW", "RECQ:MANAGE", "APPT:VIEW", "PHRM:VIEW", "BIOM:VIEW",
                    "CSAC:MANAGE", "CSCC:MANAGE", "CSMC:MANAGE", "OCCH:MANAGE", "CASE:VIEW",
                    "ASMT:MANAGE", "TELE:VIEW", "RPTA:VIEW", "MHWA:VIEW", "MENV:VIEW",
                    "CSOC:VIEW"
            )),
            Map.entry("Pharmacist", Set.of(
                    "PREG:VIEW", "RECQ:VIEW", "PHRM:MANAGE"
            )),
            Map.entry("Queue Marshall", Set.of(
                    "RECQ:MANAGE", "APPT:VIEW", "PREG:VIEW"
            )),
            Map.entry("Social Worker", Set.of(
                    "CASE:MANAGE", "CSMC:VIEW", "PREG:VIEW", "RECQ:VIEW", "CSOC:VIEW"
            )),
            Map.entry("Compliance Officer", Set.of(
                    "SADM:VIEW", "AUDT:VIEW", "IAM:VIEW", "PREG:VIEW", "RECQ:VIEW", "APPT:VIEW",
                    "PHRM:VIEW", "BIOM:VIEW", "CSAC:VIEW", "CSCC:VIEW", "CSMC:VIEW", "RPTA:VIEW",
                    "MHWA:VIEW", "OCCH:VIEW", "CASE:VIEW", "ASMT:VIEW", "TELE:VIEW", "PBIL:VIEW",
                    "MENV:VIEW", "CSOC:VIEW"
            )),
            Map.entry("Reporting Analyst", Set.of(
                    "RPTA:MANAGE", "PREG:VIEW", "RECQ:VIEW", "APPT:VIEW", "PHRM:VIEW",
                    "BIOM:VIEW", "CSAC:VIEW", "CSCC:VIEW", "CSMC:VIEW", "OCCH:VIEW",
                    "CASE:VIEW", "ASMT:VIEW", "TELE:VIEW", "MHWA:VIEW", "PBIL:VIEW",
                    "MENV:VIEW", "CSOC:VIEW"
            )),
            Map.entry("Billing Administrator", Set.of(
                    "PBIL:MANAGE", "PREG:VIEW", "APPT:VIEW", "PHRM:VIEW"
            )),
            Map.entry("Occupational Health Practitioner", Set.of(
                    "OCCH:MANAGE", "CSAC:MANAGE", "PREG:VIEW", "RECQ:MANAGE", "APPT:VIEW",
                    "PHRM:VIEW", "BIOM:VIEW", "RPTA:VIEW"
            ))
    );

    @Test
    @DisplayName("AC1: All 13 baseline roles are seeded in the database")
    void testAllBaselineRolesSeeded() {
        List<Role> allRoles = roleRepository.findAll();
        Set<String> seededRoles = new HashSet<>();
        allRoles.forEach(role -> seededRoles.add(role.getName()));

        assertThat(seededRoles)
                .as("All 13 baseline roles should be seeded")
                .containsAll(BASELINE_ROLES);
    }

    @Test
    @DisplayName("AC2: Each role has correct permissions matching the RBAC matrix")
    void testRbacMatrixCorrectness() {
        for (Map.Entry<String, Set<String>> entry : EXPECTED_MATRIX.entrySet()) {
            String roleName = entry.getKey();
            Set<String> expectedPermissions = entry.getValue();

            // Get the role
            Role role = roleRepository.findByName(roleName)
                    .orElseThrow(() -> new AssertionError("Role not found: " + roleName));

            // Get its permissions
            Set<String> actualPermissions = getPermissionsForRole(role);

            // Compare
            assertThat(actualPermissions)
                    .as("Role '%s' should have permissions matching the published matrix", roleName)
                    .isEqualTo(expectedPermissions);
        }
    }

    @Test
    @DisplayName("AC2: ORG_ADMIN has MANAGE access to all modules")
    void testOrgAdminHasFullAccess() {
        Role orgAdmin = roleRepository.findByName("ORG_ADMIN")
                .orElseThrow(() -> new AssertionError("ORG_ADMIN role not found"));

        Set<String> permissions = getPermissionsForRole(orgAdmin);

        assertThat(permissions)
                .as("ORG_ADMIN should have MANAGE access to all modules")
                .contains(
                        "SADM:MANAGE", "AUDT:MANAGE", "IAM:MANAGE", "PREG:MANAGE", "RECQ:MANAGE",
                        "APPT:MANAGE", "PHRM:MANAGE", "BIOM:MANAGE", "CSAC:MANAGE", "CSCC:MANAGE",
                        "CSMC:MANAGE", "RPTA:MANAGE", "MHWA:MANAGE", "OCCH:MANAGE", "CASE:MANAGE",
                        "ASMT:MANAGE", "TELE:MANAGE", "PBIL:MANAGE", "MENV:MANAGE", "CSOC:MANAGE"
                );
    }

    @Test
    @DisplayName("AC2: Permissions are only at VIEW or MANAGE level")
    void testPermissionLevelsAreViewOrManage() {
        List<Permission> allPermissions = permissionRepository.findAll();

        for (Permission permission : allPermissions) {
            String code = permission.getCode();
            assertThat(code)
                    .as("Permission codes should be in format MODULE:LEVEL (e.g., PREG:VIEW, PREG:MANAGE)")
                    .matches("^[A-Z]+:(VIEW|MANAGE)$");
        }
    }

    @Test
    @DisplayName("Compliance Officer has VIEW-only access to sensitive modules")
    void testComplianceOfficerViewOnly() {
        Role complianceOfficer = roleRepository.findByName("Compliance Officer")
                .orElseThrow(() -> new AssertionError("Compliance Officer role not found"));

        Set<String> permissions = getPermissionsForRole(complianceOfficer);

        // Compliance officer should have VIEW access to sensitive modules
        assertThat(permissions)
                .contains("SADM:VIEW", "AUDT:VIEW", "IAM:VIEW");

        // Should NOT have MANAGE on these
        assertThat(permissions)
                .doesNotContain("SADM:MANAGE", "AUDT:MANAGE", "IAM:MANAGE");
    }

    @Test
    @DisplayName("Clinical roles have no access to IAM and SADM modules")
    void testClinicalRolesNoAccessToIamAndSadm() {
        List<String> clinicalRoles = List.of("Doctor", "Professional Nurse", "Clinician");

        for (String roleName : clinicalRoles) {
            Role role = roleRepository.findByName(roleName)
                    .orElseThrow(() -> new AssertionError("Role not found: " + roleName));

            Set<String> permissions = getPermissionsForRole(role);

            assertThat(permissions)
                    .as("Clinical role '%s' should not have IAM or SADM access", roleName)
                    .noneMatch(p -> p.startsWith("IAM:") || p.startsWith("SADM:"));
        }
    }

    private Set<String> getPermissionsForRole(Role role) {
        Set<String> permissions = new HashSet<>();
        List<String> permissionCodes = permissionRepository.findCodesByRoleNames(List.of(role.getName()));
        permissions.addAll(permissionCodes);
        return permissions;
    }
}
