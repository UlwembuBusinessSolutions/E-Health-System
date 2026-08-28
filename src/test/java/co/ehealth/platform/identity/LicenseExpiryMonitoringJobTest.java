package co.ehealth.platform.identity;

import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.OrganizationSector;
import co.ehealth.platform.core.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LicenseExpiryMonitoringJobTest {

    @AfterEach
    void clearTenantContext() {
        TenantContext.clear();
    }

    @Test
    void scans_the_organization_tenant_and_restores_the_callers_context() {
        UserRepository users = mock(UserRepository.class);
        when(users.findAll()).thenReturn(List.of());
        LicenseExpiryMonitoringJob job = new LicenseExpiryMonitoringJob(mock(OrganizationRepository.class), users,
                Clock.fixed(Instant.parse("2026-08-24T00:00:00Z"), ZoneOffset.UTC));
        Organization organization = new Organization("clinic", "clinic_tenant", "Clinic", OrganizationSector.PRIVATE);
        TenantContext.setCurrentTenant("calling_tenant");

        job.monitorTenant(organization);

        verify(users).findAll();
        org.assertj.core.api.Assertions.assertThat(TenantContext.getCurrentTenant()).isEqualTo("calling_tenant");
    }
}
