package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.StaffService;
import co.ehealth.platform.patient.PatientService;
import co.ehealth.platform.visit.VisitService;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PrescriptionServiceLicenseGuardTest {

    @Test
    void prevents_an_unlicensed_user_from_prescribing() {
        StaffService staffService = mock(StaffService.class);
        UUID userId = UUID.randomUUID();
        when(staffService.getLicenseStatus(userId)).thenReturn(new StaffService.LicenseStatus(false, true));
        PrescriptionRepository prescriptions = mock(PrescriptionRepository.class);
        PermissionService permissions = mock(PermissionService.class);

        PrescriptionService service = service(prescriptions, staffService, permissions);

        assertThatThrownBy(() -> service.create(new PrescriptionService.CreatePrescriptionCommand(
                UUID.randomUUID(), List.of()), userId)).isInstanceOf(NotLicensedException.class);
        verify(permissions).requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        verify(prescriptions, never()).save(any());
    }

    @Test
    void prevents_a_non_sapc_user_from_dispensing() {
        StaffService staffService = mock(StaffService.class);
        UUID userId = UUID.randomUUID();
        when(staffService.getLicenseStatus(userId)).thenReturn(new StaffService.LicenseStatus(true, false));
        DispensingRecordRepository dispensingRecords = mock(DispensingRecordRepository.class);
        PermissionService permissions = mock(PermissionService.class);

        PrescriptionService service = new PrescriptionService(mock(PrescriptionRepository.class),
                mock(PrescriptionItemRepository.class), dispensingRecords, mock(StockMovementRepository.class),
                mock(VisitService.class),
                mock(PatientService.class), mock(ManualVerificationCaseRepository.class),
                mock(ManualVerificationService.class), staffService,
                mock(AuditLogService.class),
                Clock.fixed(Instant.EPOCH, ZoneOffset.UTC), permissions);

        assertThatThrownBy(() -> service.dispense(UUID.randomUUID(), userId))
                .isInstanceOf(NotLicensedException.class);
        verify(permissions).requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        verify(dispensingRecords, never()).save(any());
    }

    private PrescriptionService service(PrescriptionRepository prescriptions, StaffService staffService,
                                        PermissionService permissions) {
        return new PrescriptionService(prescriptions, mock(PrescriptionItemRepository.class),
                mock(DispensingRecordRepository.class), mock(StockMovementRepository.class), mock(VisitService.class),
                mock(PatientService.class),
                mock(ManualVerificationCaseRepository.class), mock(ManualVerificationService.class), staffService,
                mock(AuditLogService.class), Clock.fixed(Instant.EPOCH, ZoneOffset.UTC), permissions);
    }
}
