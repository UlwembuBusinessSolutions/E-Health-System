package co.ehealth.platform.platform;

import co.ehealth.platform.core.tenant.ModuleEntitlementRepository;
import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class TenantRegisterServiceTest {

    @Test
    void activeModuleCountsIncludeFoundationModulesAndUseOneGroupedQuery() {
        OrganizationRepository organizations = mock(OrganizationRepository.class);
        ModuleEntitlementRepository entitlements = mock(ModuleEntitlementRepository.class);
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        TenantRegisterService service = new TenantRegisterService(organizations, entitlements, jdbcTemplate);
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        when(entitlements.countEnabledByOrganizationIdIn(List.of(first, second)))
                .thenReturn(List.<Object[]>of(new Object[]{first, 4L}));

        Map<UUID, Integer> counts = service.activeModuleCounts(List.of(first, second));

        assertThat(counts).containsEntry(first, 7).containsEntry(second, 3);
        verify(entitlements).countEnabledByOrganizationIdIn(List.of(first, second));
        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void emptyPageDoesNotIssueAggregateCountQueries() {
        OrganizationRepository organizations = mock(OrganizationRepository.class);
        ModuleEntitlementRepository entitlements = mock(ModuleEntitlementRepository.class);
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        TenantRegisterService service = new TenantRegisterService(organizations, entitlements, jdbcTemplate);

        assertThat(service.activeModuleCounts(List.of())).isEmpty();
        assertThat(service.clinicCounts(List.<Organization>of())).isEmpty();

        verifyNoInteractions(entitlements, jdbcTemplate);
    }

    @Test
    void clinicCountsUseOneUnionAggregateQueryForThePage() {
        OrganizationRepository organizations = mock(OrganizationRepository.class);
        ModuleEntitlementRepository entitlements = mock(ModuleEntitlementRepository.class);
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        TenantRegisterService service = new TenantRegisterService(organizations, entitlements, jdbcTemplate);
        Organization first = mock(Organization.class);
        Organization second = mock(Organization.class);
        UUID firstId = UUID.randomUUID();
        UUID secondId = UUID.randomUUID();
        when(first.getId()).thenReturn(firstId);
        when(first.getSchemaName()).thenReturn("first_clinic");
        when(second.getId()).thenReturn(secondId);
        when(second.getSchemaName()).thenReturn("second_clinic");
        doAnswer(invocation -> null).when(jdbcTemplate)
                .query(anyString(), any(RowCallbackHandler.class));

        Map<UUID, Integer> counts = service.clinicCounts(List.of(first, second));

        assertThat(counts).containsEntry(firstId, 0).containsEntry(secondId, 0);
        verify(jdbcTemplate).query(
                org.mockito.ArgumentMatchers.matches("^(?=.*\"first_clinic\"\\.facilities)(?=.*\"second_clinic\"\\.facilities)(?=.*UNION ALL).*$"),
                any(RowCallbackHandler.class));
    }
}
