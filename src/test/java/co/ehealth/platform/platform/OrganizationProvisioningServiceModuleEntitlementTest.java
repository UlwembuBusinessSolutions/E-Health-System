package co.ehealth.platform.platform;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.notification.EmailService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.core.tenant.ModuleEntitlement;
import co.ehealth.platform.core.tenant.ModuleEntitlementCache;
import co.ehealth.platform.core.tenant.ModuleEntitlementRepository;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.TenantMigrationRunner;
import co.ehealth.platform.identity.StaffService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrganizationProvisioningServiceModuleEntitlementTest {

    private final OrganizationRepository organizations = mock(OrganizationRepository.class);
    private final PlatformAuditLogRepository platformAuditLogs = mock(PlatformAuditLogRepository.class);
    private final ModuleEntitlementRepository entitlements = mock(ModuleEntitlementRepository.class);
    private final ModuleEntitlementCache entitlementCache = mock(ModuleEntitlementCache.class);
    private final OrganizationProvisioningService service = new OrganizationProvisioningService(
            organizations, mock(TenantMigrationRunner.class), mock(StaffService.class), mock(AuditLogService.class),
            platformAuditLogs, mock(EmailService.class), entitlements, entitlementCache);

    @Test
    void enablingModule_persistsEntitlement_invalidatesCache_andRecordsAuditDetails() {
        UUID organizationId = UUID.randomUUID();
        UUID operatorId = UUID.randomUUID();
        when(organizations.existsById(organizationId)).thenReturn(true);
        when(entitlements.findByTenantIdAndModuleCodeAndClinicIdIsNull(organizationId, ModuleCode.PREG))
                .thenReturn(Optional.empty());
        when(entitlements.findByTenantId(organizationId))
                .thenReturn(List.of(new ModuleEntitlement(organizationId, ModuleCode.PREG, true)));

        service.setModuleEnabled(organizationId, ModuleCode.PREG, true, operatorId);

        ArgumentCaptor<ModuleEntitlement> entitlementCaptor = ArgumentCaptor.forClass(ModuleEntitlement.class);
        verify(entitlements).save(entitlementCaptor.capture());
        assertThat(entitlementCaptor.getValue().getTenantId()).isEqualTo(organizationId);
        assertThat(entitlementCaptor.getValue().getModuleCode()).isEqualTo(ModuleCode.PREG);
        assertThat(entitlementCaptor.getValue().isEnabled()).isTrue();
        verify(entitlementCache).invalidate(organizationId);

        ArgumentCaptor<PlatformAuditLog> auditCaptor = ArgumentCaptor.forClass(PlatformAuditLog.class);
        verify(platformAuditLogs).save(auditCaptor.capture());
        PlatformAuditLog audit = auditCaptor.getValue();
        assertThat(ReflectionTestUtils.getField(audit, "action")).isEqualTo("MODULE_TOGGLED");
        assertThat(ReflectionTestUtils.getField(audit, "platformOperatorId")).isEqualTo(operatorId);
        assertThat(ReflectionTestUtils.getField(audit, "organizationId")).isEqualTo(organizationId);
        assertThat(ReflectionTestUtils.getField(audit, "moduleCode")).isEqualTo(ModuleCode.PREG);
        assertThat(ReflectionTestUtils.getField(audit, "previousEnabled")).isEqualTo(false);
        assertThat(ReflectionTestUtils.getField(audit, "newEnabled")).isEqualTo(true);
    }

    @Test
    void listModuleStates_includesOffModulesAndAlwaysOnFoundationModules() {
        UUID organizationId = UUID.randomUUID();
        when(organizations.existsById(organizationId)).thenReturn(true);
        when(entitlements.findByTenantId(organizationId)).thenReturn(List.of());

        var states = service.listModuleStates(organizationId);

        assertThat(states).contains(
                new OrganizationProvisioningService.ModuleState(ModuleCode.PREG, false, false),
                new OrganizationProvisioningService.ModuleState(ModuleCode.SADM, true, true),
                new OrganizationProvisioningService.ModuleState(ModuleCode.AUDT, true, true),
                new OrganizationProvisioningService.ModuleState(ModuleCode.IAM, true, true));
    }

    @ParameterizedTest
    @EnumSource(value = ModuleCode.class, names = {"SADM", "AUDT", "IAM"})
    void foundationModules_cannotBeToggled(ModuleCode moduleCode) {
        assertThatThrownBy(() -> service.setModuleEnabled(UUID.randomUUID(), moduleCode, false, UUID.randomUUID()))
                .isInstanceOf(FoundationModuleException.class)
                .hasMessageContaining("cannot be disabled");

        verify(organizations, never()).existsById(any());
        verify(entitlements, never()).save(any());
        verify(entitlementCache, never()).invalidate(any());
        verify(platformAuditLogs, never()).save(any());
    }
}
