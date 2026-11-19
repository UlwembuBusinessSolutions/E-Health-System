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
import java.time.LocalDate;
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

class ArtInitiationSummaryServiceTest {

    @Test
    void savesPartialSummaryAndAttributesItToAuthenticatedStaff() {
        Fixture fixture = new Fixture();
        UUID staffId = UUID.randomUUID();

        ArtInitiationSummary saved = fixture.service.save(fixture.visitId,
                new ArtInitiationSummaryService.SaveArtInitiationSummaryCommand(
                        LocalDate.parse("2020-04-03"), 2008, ArtPriorTherapy.HAART, null), staffId);

        assertEquals(fixture.visitId, saved.getVisitId());
        assertEquals(2008, saved.getHivDiagnosisYear());
        assertEquals(ArtPriorTherapy.HAART, saved.getPriorTherapy());
        assertNull(saved.getDetails());
        assertEquals(staffId, saved.getUpdatedByUserId());
        assertEquals(Instant.parse("2026-11-12T10:00:00Z"), saved.getUpdatedAt());
        verify(fixture.auditLogService).append(eq(staffId), eq(fixture.facilityId),
                eq("ART_INITIATION_SUMMARY_SAVED"), eq("ArtInitiationSummary"), anyString(),
                isNull(), isNull());
    }

    @Test
    void updatesExistingVisitSummaryInsteadOfCreatingAnother() {
        Fixture fixture = new Fixture();
        UUID originalStaffId = UUID.randomUUID();
        UUID updatingStaffId = UUID.randomUUID();
        ArtInitiationSummary existing = new ArtInitiationSummary(fixture.visitId,
                LocalDate.parse("2019-01-01"), 2007, ArtPriorTherapy.PMTCT, "Initial details",
                originalStaffId, Instant.parse("2026-11-11T10:00:00Z"));
        UUID existingId = UUID.randomUUID();
        ReflectionTestUtils.setField(existing, "id", existingId);
        when(fixture.summaries.findByVisitId(fixture.visitId)).thenReturn(Optional.of(existing));
        doReturn(existing).when(fixture.summaries).save(existing);

        ArtInitiationSummary updated = fixture.service.save(fixture.visitId,
                new ArtInitiationSummaryService.SaveArtInitiationSummaryCommand(
                        null, null, null, "Updated details"), updatingStaffId);

        assertSame(existing, updated);
        assertEquals(existingId, updated.getId());
        assertNull(updated.getArtStartDate());
        assertNull(updated.getHivDiagnosisYear());
        assertNull(updated.getPriorTherapy());
        assertEquals("Updated details", updated.getDetails());
        assertEquals(originalStaffId, updated.getCreatedByUserId());
        assertEquals(updatingStaffId, updated.getUpdatedByUserId());
        verify(fixture.summaries).save(existing);
    }

    @Test
    void rejectsDiagnosisYearsOutsideTheSupportedRange() {
        Fixture fixture = new Fixture();

        assertThrows(InvalidArtInitiationSummaryException.class,
                () -> fixture.service.save(fixture.visitId,
                        new ArtInitiationSummaryService.SaveArtInitiationSummaryCommand(
                                null, 1979, null, null), UUID.randomUUID()));
        assertThrows(InvalidArtInitiationSummaryException.class,
                () -> fixture.service.save(fixture.visitId,
                        new ArtInitiationSummaryService.SaveArtInitiationSummaryCommand(
                                null, 2027, null, null), UUID.randomUUID()));

        verify(fixture.summaries, never()).save(any(ArtInitiationSummary.class));
    }

    @Test
    void rejectsNonInitiationPathway() {
        Fixture fixture = new Fixture();
        fixture.consultation.recordArtPathway(ArtPathwayCode.ADULT_ART_FOLLOW_UP_VISIT);

        assertThrows(InvalidArtInitiationSummaryException.class,
                () -> fixture.service.save(fixture.visitId,
                        new ArtInitiationSummaryService.SaveArtInitiationSummaryCommand(
                                null, null, null, null), UUID.randomUUID()));

        verify(fixture.summaries, never()).save(any(ArtInitiationSummary.class));
    }

    private static class Fixture {
        private final UUID visitId = UUID.randomUUID();
        private final UUID facilityId = UUID.randomUUID();
        private final ArtInitiationSummaryRepository summaries = mock(ArtInitiationSummaryRepository.class);
        private final VisitRepository visits = mock(VisitRepository.class);
        private final ConsultationRepository consultations = mock(ConsultationRepository.class);
        private final AuditLogService auditLogService = mock(AuditLogService.class);
        private final Consultation consultation;
        private final ArtInitiationSummaryService service;

        private Fixture() {
            UUID patientId = UUID.randomUUID();
            Visit visit = new Visit(patientId, facilityId, VisitType.NEW, ServiceStream.CHRONIC_CARE,
                    Instant.parse("2026-11-12T09:00:00Z"), UUID.randomUUID());
            when(visits.findById(visitId)).thenReturn(Optional.of(visit));
            PatientService patients = mock(PatientService.class);
            when(patients.get(patientId)).thenReturn(mock(Patient.class));
            consultation = new Consultation(visitId, UUID.randomUUID(), Instant.parse("2026-11-12T09:00:00Z"));
            consultation.recordArtPathway(ArtPathwayCode.ADULT_ART_INITIATION);
            when(consultations.findFirstByVisitIdAndStatusOrderByCreatedAtDesc(
                    visitId, ConsultationStatus.DRAFT)).thenReturn(Optional.of(consultation));
            when(summaries.save(any(ArtInitiationSummary.class))).thenAnswer(invocation -> {
                ArtInitiationSummary summary = invocation.getArgument(0);
                ReflectionTestUtils.setField(summary, "id", UUID.randomUUID());
                return summary;
            });
            service = new ArtInitiationSummaryService(summaries, visits, consultations, patients,
                    mock(PermissionService.class), auditLogService,
                    Clock.fixed(Instant.parse("2026-11-12T10:00:00Z"), ZoneOffset.UTC));
        }
    }
}
