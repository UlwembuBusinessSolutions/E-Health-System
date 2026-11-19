package co.ehealth.platform.art;

import co.ehealth.platform.consultation.ArtPathwayCode;
import co.ehealth.platform.consultation.Consultation;
import co.ehealth.platform.consultation.ConsultationRepository;
import co.ehealth.platform.consultation.ConsultationStatus;
import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientService;
import co.ehealth.platform.visit.ServiceStream;
import co.ehealth.platform.visit.Visit;
import co.ehealth.platform.visit.VisitRepository;
import co.ehealth.platform.visit.VisitType;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ArtEyesExaminationServiceTest {

    @Test
    void savesResultWithVisitAndAuthenticatedRecorder() {
        Fixture fixture = new Fixture();
        UUID staffId = UUID.randomUUID();

        ArtEyesExamination examination = fixture.service.save(
                fixture.visitId, EyeExaminationResult.NORMAL, "  Clear appearance  ", staffId);

        assertEquals(fixture.visitId, examination.getVisitId());
        assertEquals(EyeExaminationResult.NORMAL, examination.getResult());
        assertEquals("Clear appearance", examination.getComments());
        assertEquals(staffId, examination.getRecordedByUserId());
        assertEquals(Instant.parse("2026-11-16T07:00:00Z"), examination.getUpdatedAt());
        verify(fixture.auditLogService).append(eq(staffId), eq(fixture.facilityId),
                eq("ART_EYES_EXAMINATION_SAVED"), eq("ArtEyesExamination"), anyString(), isNull(), isNull());
    }

    @Test
    void updatesExistingVisitResultInsteadOfCreatingAnother() {
        Fixture fixture = new Fixture();
        UUID firstStaffId = UUID.randomUUID();
        UUID secondStaffId = UUID.randomUUID();
        ArtEyesExamination existing = new ArtEyesExamination(fixture.visitId, EyeExaminationResult.NORMAL,
                "Initial note", firstStaffId, Instant.parse("2026-11-15T07:00:00Z"));
        UUID existingId = UUID.randomUUID();
        ReflectionTestUtils.setField(existing, "id", existingId);
        when(fixture.examinations.findByVisitId(fixture.visitId)).thenReturn(Optional.of(existing));
        doReturn(existing).when(fixture.examinations).save(existing);

        ArtEyesExamination updated = fixture.service.save(
                fixture.visitId, EyeExaminationResult.ABNORMAL, null, secondStaffId);

        assertSame(existing, updated);
        assertEquals(existingId, updated.getId());
        assertEquals(EyeExaminationResult.ABNORMAL, updated.getResult());
        assertNull(updated.getComments());
        assertEquals(secondStaffId, updated.getRecordedByUserId());
        verify(fixture.examinations).save(existing);
    }

    @Test
    void requiresAResultAndAdultArtInitiationPathway() {
        Fixture fixture = new Fixture();

        assertThrows(InvalidArtEyesExaminationException.class,
                () -> fixture.service.save(fixture.visitId, null, null, UUID.randomUUID()));
        fixture.consultation.recordArtPathway(ArtPathwayCode.ADULT_ART_FOLLOW_UP_VISIT);
        assertThrows(InvalidArtEyesExaminationException.class,
                () -> fixture.service.save(
                        fixture.visitId, EyeExaminationResult.NORMAL, null, UUID.randomUUID()));

        assertThrows(InvalidArtEyesExaminationException.class,
                () -> fixture.service.save(fixture.visitId, EyeExaminationResult.NORMAL,
                        "x".repeat(10_001), UUID.randomUUID()));

        verify(fixture.examinations, never()).save(any(ArtEyesExamination.class));
    }

    private static class Fixture {
        private final UUID visitId = UUID.randomUUID();
        private final UUID facilityId = UUID.randomUUID();
        private final ArtEyesExaminationRepository examinations = mock(ArtEyesExaminationRepository.class);
        private final VisitRepository visits = mock(VisitRepository.class);
        private final ConsultationRepository consultations = mock(ConsultationRepository.class);
        private final AuditLogService auditLogService = mock(AuditLogService.class);
        private final Consultation consultation;
        private final ArtEyesExaminationService service;

        private Fixture() {
            UUID patientId = UUID.randomUUID();
            Visit visit = new Visit(patientId, facilityId, VisitType.NEW, ServiceStream.CHRONIC_CARE,
                    Instant.parse("2026-11-16T06:00:00Z"), UUID.randomUUID());
            when(visits.findById(visitId)).thenReturn(Optional.of(visit));
            PatientService patients = mock(PatientService.class);
            when(patients.get(patientId)).thenReturn(mock(Patient.class));
            consultation = new Consultation(visitId, UUID.randomUUID(), Instant.parse("2026-11-16T06:00:00Z"));
            consultation.recordArtPathway(ArtPathwayCode.ADULT_ART_INITIATION);
            when(consultations.findFirstByVisitIdAndStatusOrderByCreatedAtDesc(
                    visitId, ConsultationStatus.DRAFT)).thenReturn(Optional.of(consultation));
            when(examinations.save(any(ArtEyesExamination.class))).thenAnswer(invocation -> {
                ArtEyesExamination saved = invocation.getArgument(0);
                ReflectionTestUtils.setField(saved, "id", UUID.randomUUID());
                return saved;
            });
            service = new ArtEyesExaminationService(examinations, visits, consultations, patients,
                    mock(PermissionService.class), auditLogService,
                    Clock.fixed(Instant.parse("2026-11-16T07:00:00Z"), ZoneOffset.UTC));
        }
    }
}
