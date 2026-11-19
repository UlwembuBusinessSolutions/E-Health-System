package co.ehealth.platform.laboratory;

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
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LaboratoryInvestigationServiceTest {

    @Test
    void savesEveryInvestigationWithAuthenticatedSignerAndAuditEvent() {
        Fixture fixture = new Fixture();
        UUID staffId = UUID.randomUUID();

        List<LaboratoryInvestigation> saved = fixture.service.save(fixture.visitId, List.of(
                new LaboratoryInvestigationService.CreateLaboratoryInvestigationCommand(
                        LocalDate.parse("2026-11-10"), "  Full blood count ", "  Hb 12.1 g/dL  "),
                new LaboratoryInvestigationService.CreateLaboratoryInvestigationCommand(
                        LocalDate.parse("2026-11-11"), "CD4 count", "650 cells/mm3")), staffId);

        assertEquals(2, saved.size());
        assertEquals("Full blood count", saved.get(0).getTestName());
        assertEquals("Hb 12.1 g/dL", saved.get(0).getTestResults());
        assertEquals(staffId, saved.get(0).getSignedByUserId());
        assertEquals(Instant.parse("2026-11-11T09:00:00Z"), saved.get(0).getSignedAt());
        verify(fixture.auditLogService, times(2)).append(eq(staffId), eq(fixture.facilityId),
                eq("LABORATORY_INVESTIGATION_SIGNED"), eq("LaboratoryInvestigation"), anyString(),
                isNull(), isNull());
    }

    @Test
    void rejectsBlankTestNameBeforeSavingAnyRows() {
        Fixture fixture = new Fixture();

        assertThrows(InvalidLaboratoryInvestigationException.class,
                () -> fixture.service.save(fixture.visitId, List.of(
                        new LaboratoryInvestigationService.CreateLaboratoryInvestigationCommand(
                                LocalDate.parse("2026-11-10"), " ", "650 cells/mm3")), UUID.randomUUID()));

        verify(fixture.investigations, never()).saveAll(any());
    }

    @Test
    void rejectsEmptyBatch() {
        Fixture fixture = new Fixture();

        assertThrows(InvalidLaboratoryInvestigationException.class,
                () -> fixture.service.save(fixture.visitId, List.of(), UUID.randomUUID()));

        verify(fixture.investigations, never()).saveAll(any());
    }

    private static class Fixture {
        private final UUID visitId = UUID.randomUUID();
        private final UUID facilityId = UUID.randomUUID();
        private final LaboratoryInvestigationRepository investigations = mock(LaboratoryInvestigationRepository.class);
        private final AuditLogService auditLogService = mock(AuditLogService.class);
        private final LaboratoryInvestigationService service;

        private Fixture() {
            UUID patientId = UUID.randomUUID();
            Visit visit = new Visit(patientId, facilityId, VisitType.NEW, ServiceStream.GENERAL,
                    Instant.now(), UUID.randomUUID());
            VisitRepository visits = mock(VisitRepository.class);
            PatientService patients = mock(PatientService.class);
            when(visits.findById(visitId)).thenReturn(Optional.of(visit));
            when(patients.get(patientId)).thenReturn(mock(Patient.class));
            when(investigations.saveAll(any())).thenAnswer(invocation -> {
                List<LaboratoryInvestigation> rows = invocation.getArgument(0);
                rows.forEach(row -> ReflectionTestUtils.setField(row, "id", UUID.randomUUID()));
                return rows;
            });
            service = new LaboratoryInvestigationService(investigations, visits, patients,
                    mock(PermissionService.class), auditLogService,
                    Clock.fixed(Instant.parse("2026-11-11T09:00:00Z"), ZoneOffset.UTC));
        }
    }
}
