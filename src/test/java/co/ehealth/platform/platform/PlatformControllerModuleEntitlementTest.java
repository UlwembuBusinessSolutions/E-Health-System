package co.ehealth.platform.platform;

import co.ehealth.platform.core.security.PlatformOperatorPrincipal;
import co.ehealth.platform.core.tenant.ModuleCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PlatformController.class)
class PlatformControllerModuleEntitlementTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private OrganizationProvisioningService provisioningService;

    @Test
    void enableModule_createsOrEnablesTheOrganizationEntitlement() throws Exception {
        UUID organizationId = UUID.randomUUID();
        UUID operatorId = UUID.randomUUID();
        PlatformOperatorPrincipal principal = new PlatformOperatorPrincipal(operatorId, "test-jti");
        var authentication = new UsernamePasswordAuthenticationToken(
                principal,
                null,
                AuthorityUtils.createAuthorityList("ROLE_PLATFORM_OPERATOR")
        );

        mockMvc.perform(post("/platform/organizations/{id}/modules/{moduleCode}/enable", organizationId, ModuleCode.PREG)
                        .contentType(MediaType.APPLICATION_JSON)
                        .with(csrf())
                        .with(authentication(authentication)))
                .andExpect(status().isNoContent());

        verify(provisioningService).setModuleEnabled(
                organizationId,
                ModuleCode.PREG,
                true,
                operatorId
        );
    }

    @Test
    void disableModule_disablesTheOrganizationEntitlement() throws Exception {
        UUID organizationId = UUID.randomUUID();
        UUID operatorId = UUID.randomUUID();
        PlatformOperatorPrincipal principal = new PlatformOperatorPrincipal(operatorId, "test-jti");
        var authentication = new UsernamePasswordAuthenticationToken(
                principal, null, AuthorityUtils.createAuthorityList("ROLE_PLATFORM_OPERATOR"));

        mockMvc.perform(post("/platform/organizations/{id}/modules/{moduleCode}/disable", organizationId, ModuleCode.PREG)
                        .with(csrf())
                        .with(authentication(authentication)))
                .andExpect(status().isNoContent());

        verify(provisioningService).setModuleEnabled(organizationId, ModuleCode.PREG, false, operatorId);
    }

    @Test
    void listModules_returnsTheTenantEntitlementStates() throws Exception {
        UUID organizationId = UUID.randomUUID();
        UUID operatorId = UUID.randomUUID();
        PlatformOperatorPrincipal principal = new PlatformOperatorPrincipal(operatorId, "test-jti");
        var authentication = new UsernamePasswordAuthenticationToken(
                principal, null, AuthorityUtils.createAuthorityList("ROLE_PLATFORM_OPERATOR"));
        when(provisioningService.listModuleStates(organizationId)).thenReturn(java.util.List.of(
                new OrganizationProvisioningService.ModuleState(ModuleCode.PREG, false, false)));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/platform/organizations/{id}/modules", organizationId)
                        .with(authentication(authentication)))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .jsonPath("$.items[0].moduleCode").value("PREG"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .jsonPath("$.items[0].enabled").value(false));
    }

    @ParameterizedTest
    @EnumSource(value = ModuleCode.class, names = {"SADM", "AUDT", "IAM"})
    void disableFoundationModule_returnsConflict(ModuleCode moduleCode) throws Exception {
        UUID organizationId = UUID.randomUUID();
        UUID operatorId = UUID.randomUUID();
        PlatformOperatorPrincipal principal = new PlatformOperatorPrincipal(operatorId, "test-jti");
        var authentication = new UsernamePasswordAuthenticationToken(
                principal, null, AuthorityUtils.createAuthorityList("ROLE_PLATFORM_OPERATOR"));
        doThrow(new FoundationModuleException(moduleCode + " is a Platform Foundation module and cannot be disabled."))
                .when(provisioningService).setModuleEnabled(organizationId, moduleCode, false, operatorId);

        mockMvc.perform(post("/platform/organizations/{id}/modules/{moduleCode}/disable", organizationId, moduleCode)
                        .with(csrf())
                        .with(authentication(authentication)))
                .andExpect(status().isConflict());
    }
}
