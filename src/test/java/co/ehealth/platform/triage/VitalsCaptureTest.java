package co.ehealth.platform.triage;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.UserRepository;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientService;
import co.ehealth.platform.visit.Visit;
import co.ehealth.platform.visit.VisitRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.*;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class VitalsCaptureTest {
    final TriageAssessmentRepository repository = mock(TriageAssessmentRepository.class);
    final VisitRepository visits = mock(VisitRepository.class);
    final PatientService patients = mock(PatientService.class);
    final UUID visitId = UUID.randomUUID(), patientId = UUID.randomUUID(), actor = UUID.randomUUID();
    final TriageService service = new TriageService(repository, visits, patients, mock(UserRepository.class),
            mock(AuditLogService.class), mock(PermissionService.class), Clock.fixed(Instant.parse("2026-09-08T12:00:00Z"), ZoneOffset.UTC));

    @BeforeEach void setup() {
        Visit visit = mock(Visit.class); Patient patient = mock(Patient.class);
        when(visit.getPatientId()).thenReturn(patientId);
        when(visits.findById(visitId)).thenReturn(Optional.of(visit));
        when(patients.get(patientId)).thenReturn(patient);
        when(patient.getDateOfBirth()).thenReturn(LocalDate.of(1990, 1, 1));
        when(repository.save(any())).thenAnswer(invocation -> {
            TriageAssessment a = invocation.getArgument(0);
            ReflectionTestUtils.setField(a, "id", UUID.randomUUID()); return a;
        });
    }

    private TriageService.TriageCaptureCommand command(AdditionalObservations additional, ScoringProfile profile, TriageColour colour) {
        return new TriageService.TriageCaptureCommand(visitId, false, null, profile, 18, 80, 120, 80, 37.0, 98,
                OxygenSupport.ROOM_AIR, null, null, Avpu.ALERT, Mobility.WALKING, 0, "NRS", "Test", Set.of(),
                null, null, "test-key", false, colour, colour == null ? null : "Clinician assessment", additional);
    }

    @Test void capturePassesAdditionalMeasurementsToRepositoryAndResponse() {
        var additional = new AdditionalObservations(); additional.traumaPresent = true;
        additional.weightKg = 72.5; additional.heightCm = 170.0; additional.glucoseMmolL = 5.6;
        additional.haemoglobinGdl = 12.3; additional.urineProtein = "NEGATIVE";
        var saved = service.capture(command(additional, ScoringProfile.ADULT, null), actor);
        verify(repository).save(saved);
        assertSame(additional, saved.getAdditionalObservations());
        assertSame(additional, TriageController.TriageAssessmentResponse.from(saved).additionalObservations());
        assertEquals(1, saved.getTewsScore());
        assertEquals(actor, saved.getCapturedByUserId());
    }

    @Test void cannotSilentlyTreatUnassessedTraumaAsAbsent() {
        assertThrows(InvalidTriageCaptureException.class, () -> service.capture(command(new AdditionalObservations(), ScoringProfile.ADULT, null), actor));
        verify(repository, never()).save(any());
    }

    @Test void invalidInvestigationsAreRejectedBeforeSaving() {
        var additional = new AdditionalObservations(); additional.traumaPresent = false; additional.urineNitrites = "TRACE";
        assertThrows(InvalidTriageCaptureException.class, () -> service.capture(command(additional, ScoringProfile.ADULT, null), actor));
        verify(repository, never()).save(any());
    }

    @Test void paediatricConfirmationCannotDowngradeLowGlucose() {
        var additional = new AdditionalObservations(); additional.traumaPresent = false; additional.glucoseMmolL = 2.5;
        assertThrows(InvalidTriageCaptureException.class, () -> service.capture(command(additional, ScoringProfile.PAEDIATRIC_OLDER_CHILD, TriageColour.GREEN), actor));
        verify(repository, never()).save(any());
        assertEquals(TriageColour.RED, service.capture(command(additional, ScoringProfile.PAEDIATRIC_OLDER_CHILD, TriageColour.RED), actor).getFinalColour());
    }

    @Test void retryReturnsOriginalWithoutSavingAnotherReading() {
        var saved = mock(TriageAssessment.class);
        when(repository.findByVisitIdAndIdempotencyKey(visitId, "test-key")).thenReturn(Optional.of(saved));
        assertSame(saved, service.capture(command(null, ScoringProfile.ADULT, null), actor));
        verify(repository, never()).save(any());
    }

    @Test void implausibleWeightRequiresConfirmation() {
        var additional = new AdditionalObservations(); additional.traumaPresent = false; additional.weightKg = 5000.0;
        var error = assertThrows(InvalidTriageCaptureException.class,
                () -> service.capture(command(additional, ScoringProfile.ADULT, null), actor));
        assertTrue(error.getMessage().contains("Confirm"));
        verify(repository, never()).save(any());
    }
}
