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

class ArtReproductiveHealthDetailsServiceTest {

    @Test
    void savesValidDetailsWithAuthenticatedRecorder() {
        Fixture fixture = new Fixture();
        UUID staffId = UUID.randomUUID();

        ArtReproductiveHealthDetails details = fixture.service.save(
                fixture.visitId,
                new ArtReproductiveHealthDetailsService.SaveArtReproductiveHealthDetailsCommand(
                        true,
                        2,
                        "G2",
                        "P1",
                        ContraceptionMethod.PILL,
                        null,
                        true,
                        "Pain when passing urine",
                        false,
                        null,
                        false,
                        null,
                        true,
                        "Lesion noted",
                        false,
                        null,
                        "Pap result",
                        LocalDate.of(2026, 11, 15),
                        LocalDate.of(2026, 11, 16),
                        "Normal findings",
                        "Treatment completed"),
                staffId);

        assertEquals(fixture.visitId, details.getVisitId());
        assertEquals(Boolean.TRUE, details.getPregnant());
        assertEquals(2, details.getTrimester());
        assertEquals("G2", details.getGravida());
        assertEquals("P1", details.getPara());
        assertEquals(ContraceptionMethod.PILL, details.getContraceptionMethod());
        assertEquals("Pain when passing urine", details.getUrethralDischargeComment());
        assertEquals("Treatment completed", details.getSpecifyTreatmentCompleted());
        verify(fixture.auditLogService).append(eq(staffId), eq(fixture.facilityId),
                eq("ART_REPRODUCTIVE_HEALTH_DETAILS_SAVED"), eq("ArtReproductiveHealthDetails"), anyString(), isNull(), isNull());
    }

    @Test
    void updatesExistingVisitRecordInsteadOfCreatingAnother() {
        Fixture fixture = new Fixture();
        UUID firstStaffId = UUID.randomUUID();
        UUID secondStaffId = UUID.randomUUID();
        ArtReproductiveHealthDetails existing = new ArtReproductiveHealthDetails(fixture.visitId, firstStaffId,
                Instant.parse("2026-11-15T07:00:00Z"));
        UUID existingId = UUID.randomUUID();
        ReflectionTestUtils.setField(existing, "id", existingId);
        when(fixture.details.findByVisitId(fixture.visitId)).thenReturn(Optional.of(existing));
        doReturn(existing).when(fixture.details).save(existing);

        ArtReproductiveHealthDetails updated = fixture.service.save(
                fixture.visitId,
                new ArtReproductiveHealthDetailsService.SaveArtReproductiveHealthDetailsCommand(
                        false,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null),
                secondStaffId);

        assertSame(existing, updated);
        assertEquals(existingId, updated.getId());
        assertEquals(Boolean.FALSE, updated.getPregnant());
        assertNull(updated.getTrimester());
        assertEquals(secondStaffId, updated.getUpdatedByUserId());
        verify(fixture.details).save(existing);
    }

    @Test
    void requiresAdultArtInitiationPathwayAndPregnancyCaptureRules() {
        Fixture fixture = new Fixture();

        assertThrows(InvalidArtReproductiveHealthDetailsException.class,
                () -> fixture.service.save(
                        fixture.visitId,
                        new ArtReproductiveHealthDetailsService.SaveArtReproductiveHealthDetailsCommand(
                                true,
                                null,
                                "G1",
                                "P1",
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null),
                        UUID.randomUUID()));

        fixture.consultation.recordArtPathway(ArtPathwayCode.ADULT_ART_FOLLOW_UP_VISIT);
        assertThrows(InvalidArtReproductiveHealthDetailsException.class,
                () -> fixture.service.save(
                        fixture.visitId,
                        new ArtReproductiveHealthDetailsService.SaveArtReproductiveHealthDetailsCommand(
                                false,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null),
                        UUID.randomUUID()));

        assertThrows(InvalidArtReproductiveHealthDetailsException.class,
                () -> fixture.service.save(
                        fixture.visitId,
                        new ArtReproductiveHealthDetailsService.SaveArtReproductiveHealthDetailsCommand(
                                true,
                                5,
                                "G1",
                                "P1",
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null),
                        UUID.randomUUID()));

        verify(fixture.details, never()).save(any(ArtReproductiveHealthDetails.class));
    }

    private static class Fixture {
        private final UUID visitId = UUID.randomUUID();
        private final UUID facilityId = UUID.randomUUID();
        private final ArtReproductiveHealthDetailsRepository details = mock(ArtReproductiveHealthDetailsRepository.class);
        private final VisitRepository visits = mock(VisitRepository.class);
        private final ConsultationRepository consultations = mock(ConsultationRepository.class);
        private final AuditLogService auditLogService = mock(AuditLogService.class);
        private final Consultation consultation;
        private final ArtReproductiveHealthDetailsService service;

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
            when(details.save(any(ArtReproductiveHealthDetails.class))).thenAnswer(invocation -> {
                ArtReproductiveHealthDetails saved = invocation.getArgument(0);
                ReflectionTestUtils.setField(saved, "id", UUID.randomUUID());
                return saved;
            });
            service = new ArtReproductiveHealthDetailsService(
                    details,
                    visits,
                    consultations,
                    patients,
                    mock(PermissionService.class),
                    auditLogService,
                    Clock.fixed(Instant.parse("2026-11-16T07:00:00Z"), ZoneOffset.UTC));
        }
    }
}
