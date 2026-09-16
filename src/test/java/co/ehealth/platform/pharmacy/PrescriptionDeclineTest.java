package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.clinic.ClinicContext;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.StaffService;
import co.ehealth.platform.patient.PatientService;
import co.ehealth.platform.visit.VisitService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PrescriptionDeclineTest {
    @AfterEach void clear() { ClinicContext.clear(); }

    @Test void decline_requires_code_and_prevents_later_dispensing() {
        UUID facility = UUID.randomUUID(), actor = UUID.randomUUID(), id = UUID.randomUUID();
        ClinicContext.set(facility);
        Prescription prescription = new Prescription("RX-0000001", UUID.randomUUID(), UUID.randomUUID(),
                facility, UUID.randomUUID(), Instant.EPOCH);
        ReflectionTestUtils.setField(prescription, "id", id);
        PrescriptionRepository prescriptions = mock(PrescriptionRepository.class);
        when(prescriptions.findByIdAndFacilityId(id, facility)).thenReturn(Optional.of(prescription));
        StaffService staff = mock(StaffService.class);
        when(staff.getLicenseStatus(actor)).thenReturn(new StaffService.LicenseStatus(true, true));
        PrescriptionDeclineRepository declines = mock(PrescriptionDeclineRepository.class);
        when(declines.save(any())).thenAnswer(invocation -> {
            PrescriptionDecline value = invocation.getArgument(0);
            ReflectionTestUtils.setField(value, "id", UUID.randomUUID());
            return value;
        });
        PrescriptionDeclineNotificationRepository notifications = mock(PrescriptionDeclineNotificationRepository.class);
        AuditLogService audit = mock(AuditLogService.class);
        PrescriptionService service = new PrescriptionService(prescriptions, mock(PrescriptionItemRepository.class),
                mock(DispensingRecordRepository.class), mock(StockMovementRepository.class), mock(VisitService.class),
                mock(PatientService.class), mock(ManualVerificationCaseRepository.class), mock(ManualVerificationService.class),
                staff, audit, Clock.fixed(Instant.EPOCH, ZoneOffset.UTC), mock(PermissionService.class));
        ReflectionTestUtils.setField(service, "declineRepository", declines);
        ReflectionTestUtils.setField(service, "declineNotifications", notifications);

        assertThatThrownBy(() -> service.decline(id, actor, null, null)).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(declines, notifications);
        service.decline(id, actor, DeclineReasonCode.DUPLICATE_SUPPLY, "Supply remains at home");
        verify(notifications).save(any(PrescriptionDeclineNotification.class));
        verify(audit).append(eq(actor), eq(facility), eq("PRESCRIPTION_DECLINED"), eq("Prescription"),
                eq(id.toString()), isNull(), contains("DUPLICATE_SUPPLY"));
        assertThatThrownBy(() -> service.dispense(id, actor)).isInstanceOf(PrescriptionAlreadyDispensedException.class);
    }
}
