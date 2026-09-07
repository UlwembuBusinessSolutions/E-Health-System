package co.ehealth.platform.integration;

import co.ehealth.platform.core.common.ApiErrorResponse;
import co.ehealth.platform.identity.NotAuthorizedException;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration tests validating IAM-US-009 AC3:
 * Given a role/module combination is marked no-access,
 * When a user of that role calls the endpoint,
 * Then they receive an explicit 403 rather than an empty result set.
 *
 * These tests validate the full HTTP response flow, from controller through
 * PermissionService to the GlobalExceptionHandler returning 403 FORBIDDEN.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(locations = "classpath:application-test.yml")
@DisplayName("HTTP 403 Responses for No-Access - IAM-US-009 AC3 Integration")
class Permission403ResponseIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("AC3: POST /api/v1/patients returns 403 when user lacks PREG:MANAGE")
    @WithMockUser(username = "queue.marshall@clinic.local", roles = {"Queue Marshall"})
    void testPatientRegistrationReturnsForbidden() throws Exception {
        // Queue Marshall has RECQ:MANAGE, APPT:VIEW, PREG:VIEW
        // They do NOT have PREG:MANAGE, so patient registration should fail with 403

        String payload = """
                {
                  "firstName": "John",
                  "lastName": "Doe",
                  "idNumber": "9001015800081",
                  "address": "123 Main St",
                  "contactNumber": "+27821234567",
                  "medicalAidProvider": null,
                  "medicalAidNumber": null,
                  "nextOfKin": []
                }
                """;

        MvcResult result = mockMvc.perform(post("/api/v1/patients")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isForbidden())
                .andReturn();

        // Verify we get a proper error response, not an empty list
        String responseBody = result.getResponse().getContentAsString();
        assertThat(responseBody)
                .as("Response should contain 'manage' and module name, not be empty")
                .contains("manage")
                .contains("Patient Registration");
    }

    @Test
    @DisplayName("AC3: POST /api/v1/prescriptions returns 403 when user lacks PHRM:MANAGE")
    @WithMockUser(username = "clinician@clinic.local", roles = {"Clinician"})
    void testPrescriptionCreationReturnsForbidden() throws Exception {
        // Clinician has PHRM:VIEW only, not PHRM:MANAGE
        // Prescription creation requires PHRM:MANAGE

        String payload = """
                {
                  "visitId": "550e8400-e29b-41d4-a716-446655440000",
                  "items": [
                    {
                      "drugName": "Paracetamol",
                      "dosage": "500mg",
                      "quantity": 2
                    }
                  ]
                }
                """;

        MvcResult result = mockMvc.perform(post("/api/v1/prescriptions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isForbidden())
                .andReturn();

        String responseBody = result.getResponse().getContentAsString();
        assertThat(responseBody)
                .as("Response should be a proper 403 error, not empty")
                .isNotEmpty()
                .contains("manage");
    }

    @Test
    @DisplayName("AC3: GET /api/v1/prescriptions returns 403 when user lacks PHRM:VIEW")
    @WithMockUser(username = "queuemarshall@clinic.local", roles = {"Queue Marshall"})
    void testPrescriptionListReturnsForbidden() throws Exception {
        // Queue Marshall has no PHRM permission

        MvcResult result = mockMvc.perform(get("/api/v1/prescriptions/queue")
                .param("facilityId", "550e8400-e29b-41d4-a716-446655440000"))
                .andExpect(status().isForbidden())
                .andReturn();

        String responseBody = result.getResponse().getContentAsString();
        assertThat(responseBody)
                .as("Response should not be empty when permission denied")
                .isNotEmpty();
    }

    @Test
    @DisplayName("AC3: Requests with MANAGE permission succeed (positive case)")
    @WithMockUser(username = "pharmacist@clinic.local", roles = {"Pharmacist"})
    void testPharmacistCanCreatePrescription() throws Exception {
        // Pharmacist has PHRM:MANAGE, so should be able to call pharmacy endpoints
        // (This test documents the success path for comparison)

        String payload = """
                {
                  "visitId": "550e8400-e29b-41d4-a716-446655440000",
                  "items": [
                    {
                      "drugName": "Paracetamol",
                      "dosage": "500mg",
                      "quantity": 2
                    }
                  ]
                }
                """;

        // This may fail for other reasons (visit doesn't exist, etc.) but NOT for permission
        MvcResult result = mockMvc.perform(post("/api/v1/prescriptions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andReturn();

        // Should NOT be 403 (permission denied)
        // May be 400 (bad request), 404 (not found), etc., but not 403
        assertThat(result.getResponse().getStatus())
                .as("Pharmacist with PHRM:MANAGE should not get 403")
                .isNotEqualTo(HttpStatus.FORBIDDEN.value());
    }

    @Test
    @DisplayName("AC3: Clinical role cannot access IAM admin endpoints")
    @WithMockUser(username = "doctor@clinic.local", roles = {"Doctor"})
    void testDoctorCannotAccessIamAdminEndpoints() throws Exception {
        // Doctor has no IAM permissions, should get 403 on admin staff endpoints

        MvcResult result = mockMvc.perform(get("/api/v1/admin/staff"))
                .andReturn();

        assertThat(result.getResponse().getStatus())
                .as("Doctor should not have access to admin/staff endpoint")
                .isEqualTo(HttpStatus.FORBIDDEN.value());
    }

    @Test
    @DisplayName("AC3: Non-ORG_ADMIN cannot access platform admin endpoints")
    @WithMockUser(username = "compliance@clinic.local", roles = {"Compliance Officer"})
    void testNonAdminCannotAccessPlatformAdmin() throws Exception {
        // Compliance Officer has admin view permissions but not manage
        // Endpoints that require ORG_ADMIN role should deny with 403

        MvcResult result = mockMvc.perform(post("/api/v1/facilities")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andReturn();

        assertThat(result.getResponse().getStatus())
                .as("Non-ORG_ADMIN should get 403 for facility creation")
                .isEqualTo(HttpStatus.FORBIDDEN.value());
    }
}
