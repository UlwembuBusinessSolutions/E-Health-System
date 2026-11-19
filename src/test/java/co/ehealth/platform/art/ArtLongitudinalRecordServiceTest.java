package co.ehealth.platform.art;

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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ArtLongitudinalRecordServiceTest {

    @Test
    void savesVisitLinkedRecordWithAuthenticatedSignerAndAuditEvent() {
        Fixture fixture = new Fixture();
        UUID staffId = UUID.randomUUID();

        ArtLongitudinalRecord record = fixture.service.save(fixture.visitId,
                new ArtLongitudinalRecordService.CreateArtLongitudinalRecordCommand(
                        LocalDate.parse("2026-11-12"), "18 months", ArtStage.STAGE_2,
                        "Below 50 copies/mL", "650 cells/mm3", "Stable on current ART"), staffId);

        assertEquals(fixture.visitId, record.getVisitId());
        assertEquals(ArtStage.STAGE_2, record.getStage());
        assertEquals(staffId, record.getSignedByUserId());
        assertEquals(Instant.parse("2026-11-12T10:00:00Z"), record.getSignedAt());
        verify(fixture.auditLogService).append(eq(staffId), eq(fixture.facilityId),
                eq("ART_LONGITUDINAL_RECORD_SIGNED"), eq("ArtLongitudinalRecord"), anyString(),
                isNull(), isNull());
    }

    @Test
    void optionalTextFieldsCanBeOmitted() {
        Fixture fixture = new Fixture();

        ArtLongitudinalRecord record = fixture.service.save(fixture.visitId,
                new ArtLongitudinalRecordService.CreateArtLongitudinalRecordCommand(
                        LocalDate.parse("2026-11-12"), " ", ArtStage.STAGE_1, null, null, null),
                UUID.randomUUID());

        assertNull(record.getDurationOnArt());
        assertNull(record.getViralLoad());
        assertNull(record.getCd4Count());
        assertNull(record.getStageDescription());
    }

    @Test
    void requiresDateAndStageBeforeSaving() {
        Fixture fixture = new Fixture();

        assertThrows(InvalidArtLongitudinalRecordException.class,
                () -> fixture.service.save(fixture.visitId,
                        new ArtLongitudinalRecordService.CreateArtLongitudinalRecordCommand(
                                null, null, ArtStage.STAGE_1, null, null, null), UUID.randomUUID()));
        assertThrows(InvalidArtLongitudinalRecordException.class,
                () -> fixture.service.save(fixture.visitId,
                        new ArtLongitudinalRecordService.CreateArtLongitudinalRecordCommand(
                                LocalDate.parse("2026-11-12"), null, null, null, null, null), UUID.randomUUID()));

        verify(fixture.records, never()).save(any(ArtLongitudinalRecord.class));
    }

    private static class Fixture {
        private final UUID visitId = UUID.randomUUID();
        private final UUID facilityId = UUID.randomUUID();
        private final ArtLongitudinalRecordRepository records = mock(ArtLongitudinalRecordRepository.class);
        private final AuditLogService auditLogService = mock(AuditLogService.class);
        private final ArtLongitudinalRecordService service;

        private Fixture() {
            UUID patientId = UUID.randomUUID();
            Visit visit = new Visit(patientId, facilityId, VisitType.NEW, ServiceStream.CHRONIC_CARE,
                    Instant.parse("2026-11-12T09:00:00Z"), UUID.randomUUID());
            VisitRepository visits = mock(VisitRepository.class);
            PatientService patients = mock(PatientService.class);
            when(visits.findById(visitId)).thenReturn(Optional.of(visit));
            when(patients.get(patientId)).thenReturn(mock(Patient.class));
            when(records.save(any(ArtLongitudinalRecord.class))).thenAnswer(invocation -> {
                ArtLongitudinalRecord record = invocation.getArgument(0);
                ReflectionTestUtils.setField(record, "id", UUID.randomUUID());
                return record;
            });
            service = new ArtLongitudinalRecordService(records, visits, patients,
                    mock(PermissionService.class), auditLogService,
                    Clock.fixed(Instant.parse("2026-11-12T10:00:00Z"), ZoneOffset.UTC));
        }
    }
}
