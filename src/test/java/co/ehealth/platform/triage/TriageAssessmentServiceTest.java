package co.ehealth.platform.triage;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.visit.ServiceStream;
import co.ehealth.platform.visit.Visit;
import co.ehealth.platform.visit.VisitService;
import co.ehealth.platform.visit.VisitType;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TriageAssessmentServiceTest {

    @Test
    void rejects_measurements_outside_plausible_human_ranges() {
        TriageAssessmentRepository repository = mock(TriageAssessmentRepository.class);
        PermissionService permissions = mock(PermissionService.class);
        TriageAssessmentService service = service(repository, permissions);

        assertThatThrownBy(() -> service.capture(command(301, 80, 80, "37.0", 16, true), UUID.randomUUID()))
                .isInstanceOf(ClinicalRangeException.class)
                .hasMessageContaining("clinically plausible");
        verify(permissions).requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        verify(repository, never()).save(any());
    }

    @Test
    void requires_confirmation_for_abnormal_but_plausible_measurements() {
        TriageAssessmentRepository repository = mock(TriageAssessmentRepository.class);
        TriageAssessmentService service = service(repository, mock(PermissionService.class));

        assertThatThrownBy(() -> service.capture(command(190, 100, 80, "37.0", 16, false), UUID.randomUUID()))
                .isInstanceOf(ClinicalRangeException.class)
                .hasMessageContaining("require confirmation");
        verify(repository, never()).save(any());
    }

    @Test
    void returns_the_latest_prior_reading_when_capturing_vitals() {
        TriageAssessmentRepository repository = mock(TriageAssessmentRepository.class);
        VisitService visits = mock(VisitService.class);
        UUID visitId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        when(visits.get(visitId)).thenReturn(new Visit(patientId, UUID.randomUUID(), VisitType.NEW,
                ServiceStream.GENERAL, Instant.EPOCH, UUID.randomUUID()));
        TriageAssessment prior = mock(TriageAssessment.class);
        TriageAssessment saved = mock(TriageAssessment.class);
        when(saved.getId()).thenReturn(UUID.randomUUID());
        when(repository.findFirstByPatientIdOrderByCapturedAtDesc(patientId)).thenReturn(Optional.of(prior));
        when(repository.save(any(TriageAssessment.class))).thenReturn(saved);
        TriageAssessmentService service = new TriageAssessmentService(repository, visits, mock(AuditLogService.class),
                mock(PermissionService.class), Clock.fixed(Instant.EPOCH, ZoneOffset.UTC));

        TriageAssessmentService.CaptureResult result = service.capture(command(120, 80, 80, "37.0", 16, false),
                UUID.randomUUID());

        org.assertj.core.api.Assertions.assertThat(result.priorAssessment()).isSameAs(prior);
        verify(repository).findFirstByPatientIdOrderByCapturedAtDesc(eq(patientId));
    }

    private TriageAssessmentService service(TriageAssessmentRepository repository, PermissionService permissions) {
        return new TriageAssessmentService(repository, mock(VisitService.class), mock(AuditLogService.class),
                permissions, Clock.fixed(Instant.EPOCH, ZoneOffset.UTC));
    }

    private TriageAssessmentService.CaptureVitalsCommand command(int systolic, int diastolic, int heartRate,
                                                                    String temperature, int respiratoryRate,
                                                                    boolean confirmed) {
        return new TriageAssessmentService.CaptureVitalsCommand(UUID.randomUUID(), systolic, diastolic, heartRate,
                new BigDecimal(temperature), respiratoryRate, AvpuLevel.ALERT, confirmed);
    }
}
