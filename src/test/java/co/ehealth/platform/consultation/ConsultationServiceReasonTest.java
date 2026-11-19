package co.ehealth.platform.consultation;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.diagnosis.DiagnosisCatalogueService;
import co.ehealth.platform.facility.FacilityService;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientRepository;
import co.ehealth.platform.patient.PatientService;
import co.ehealth.platform.pharmacy.PrescriptionService;
import co.ehealth.platform.triage.TriageAssessmentRepository;
import co.ehealth.platform.visit.QueueService;
import co.ehealth.platform.visit.ServiceStream;
import co.ehealth.platform.visit.Visit;
import co.ehealth.platform.visit.VisitRepository;
import co.ehealth.platform.visit.VisitType;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ConsultationServiceReasonTest {

    @Test
    void chronicCareReasonIsStoredOnTheConsultation() {
        Fixture fixture = new Fixture(ServiceStream.CHRONIC_CARE);

        Consultation consultation = fixture.service.createDraft(fixture.visitId, fixture.staffId,
                VitalsBypassReason.EMERGENCY, null, null, ServiceReasonCode.OTHER, "  Review symptoms  ");

        assertEquals(ServiceReasonCode.OTHER, consultation.getServiceReasonCode());
        assertEquals("Review symptoms", consultation.getServiceReasonNote());
    }

    @Test
    void chronicCareConsultationRequiresAReason() {
        Fixture fixture = new Fixture(ServiceStream.CHRONIC_CARE);

        assertThrows(InvalidConsultationException.class, () -> fixture.service.createDraft(fixture.visitId,
                fixture.staffId, VitalsBypassReason.EMERGENCY, null, null, null, null));

        verify(fixture.consultations, never()).save(any(Consultation.class));
    }

    @Test
    void otherReasonRequiresAnExplanation() {
        Fixture fixture = new Fixture(ServiceStream.CHRONIC_CARE);

        assertThrows(InvalidConsultationException.class, () -> fixture.service.createDraft(fixture.visitId,
                fixture.staffId, VitalsBypassReason.EMERGENCY, null, null, ServiceReasonCode.OTHER, "no"));

        verify(fixture.consultations, never()).save(any(Consultation.class));
    }

    @Test
    void otherStreamsRejectChronicCareReasons() {
        Fixture fixture = new Fixture(ServiceStream.GENERAL);

        assertThrows(InvalidConsultationException.class, () -> fixture.service.createDraft(fixture.visitId,
                fixture.staffId, VitalsBypassReason.EMERGENCY, null, null, ServiceReasonCode.ART, null));

        verify(fixture.consultations, never()).save(any(Consultation.class));
    }

    @Test
    void artPathwayIsStoredOnTheConsultation() {
        Fixture fixture = new Fixture(ServiceStream.CHRONIC_CARE);

        Consultation consultation = fixture.service.createDraft(fixture.visitId, fixture.staffId,
                VitalsBypassReason.EMERGENCY, null, null, ServiceReasonCode.ART, null,
                ArtPathwayCode.ADULT_ART_INITIATION);

        assertEquals(ArtPathwayCode.ADULT_ART_INITIATION, consultation.getArtPathwayCode());
    }

    @Test
    void artPathwayCannotBeUsedWithAnotherReason() {
        Fixture fixture = new Fixture(ServiceStream.CHRONIC_CARE);

        assertThrows(InvalidConsultationException.class, () -> fixture.service.createDraft(fixture.visitId,
                fixture.staffId, VitalsBypassReason.EMERGENCY, null, null, ServiceReasonCode.ASTHMA, null,
                ArtPathwayCode.ADULT_ART_INITIATION));

        verify(fixture.consultations, never()).save(any(Consultation.class));
    }

    @Test
    void artReasonRequiresAPathway() {
        Fixture fixture = new Fixture(ServiceStream.CHRONIC_CARE);

        assertThrows(InvalidConsultationException.class, () -> fixture.service.createDraft(fixture.visitId,
                fixture.staffId, VitalsBypassReason.EMERGENCY, null, null, ServiceReasonCode.ART, null));

        verify(fixture.consultations, never()).save(any(Consultation.class));
    }

    @Test
    void draftServiceReasonCanBeChangedAndOldArtPathwayIsCleared() {
        Fixture fixture = new Fixture(ServiceStream.CHRONIC_CARE);
        Consultation draft = new Consultation(fixture.visitId, fixture.staffId, Instant.now());
        draft.recordServiceReason(ServiceReasonCode.ART, null);
        draft.recordArtPathway(ArtPathwayCode.ADULT_ART_INITIATION);
        UUID consultationId = UUID.randomUUID();
        ReflectionTestUtils.setField(draft, "id", consultationId);
        when(fixture.consultations.findById(consultationId)).thenReturn(Optional.of(draft));

        Consultation updated = fixture.service.updateServiceReason(consultationId, ServiceReasonCode.ASTHMA, null,
                null);

        assertEquals(ServiceReasonCode.ASTHMA, updated.getServiceReasonCode());
        assertNull(updated.getArtPathwayCode());
        verify(fixture.consultations).save(draft);
    }

    @Test
    void changingDraftToArtRequiresAPathway() {
        Fixture fixture = new Fixture(ServiceStream.CHRONIC_CARE);
        Consultation draft = new Consultation(fixture.visitId, fixture.staffId, Instant.now());
        UUID consultationId = UUID.randomUUID();
        ReflectionTestUtils.setField(draft, "id", consultationId);
        when(fixture.consultations.findById(consultationId)).thenReturn(Optional.of(draft));

        assertThrows(InvalidConsultationException.class, () -> fixture.service.updateServiceReason(consultationId,
                ServiceReasonCode.ART, null, null));

        verify(fixture.consultations, never()).save(draft);
    }

    private static class Fixture {
        private final UUID visitId = UUID.randomUUID();
        private final UUID staffId = UUID.randomUUID();
        private final ConsultationRepository consultations = mock(ConsultationRepository.class);
        private final ConsultationService service;

        private Fixture(ServiceStream stream) {
            UUID patientId = UUID.randomUUID();
            UUID facilityId = UUID.randomUUID();
            Visit visit = new Visit(patientId, facilityId, VisitType.NEW, stream, Instant.now(), staffId);
            VisitRepository visits = mock(VisitRepository.class);
            PatientService patients = mock(PatientService.class);
            ConsultationDiagnosisRepository diagnoses = mock(ConsultationDiagnosisRepository.class);
            TriageAssessmentRepository triage = mock(TriageAssessmentRepository.class);
            when(visits.findById(visitId)).thenReturn(Optional.of(visit));
            when(patients.get(patientId)).thenReturn(mock(Patient.class));
            when(consultations.findFirstByVisitIdAndStatusOrderByCreatedAtDesc(visitId, ConsultationStatus.DRAFT))
                    .thenReturn(Optional.empty());
            when(triage.findActiveOrderByObservedAtDesc(visitId)).thenReturn(List.of());
            when(consultations.save(any(Consultation.class))).thenAnswer(invocation -> {
                Consultation saved = invocation.getArgument(0);
                ReflectionTestUtils.setField(saved, "id", UUID.randomUUID());
                return saved;
            });

            service = new ConsultationService(consultations, diagnoses, visits, patients,
                    mock(PatientRepository.class), mock(AuditLogService.class), mock(PermissionService.class),
                    mock(QueueService.class), mock(FacilityService.class), mock(PrescriptionService.class), triage,
                    mock(DiagnosisCatalogueService.class), Clock.fixed(Instant.parse("2026-11-11T09:00:00Z"),
                    ZoneOffset.UTC), new com.fasterxml.jackson.databind.ObjectMapper());
        }
    }
}
