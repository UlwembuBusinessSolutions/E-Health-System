package co.ehealth.platform.patient;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.identity.Gender;
import co.ehealth.platform.identity.PermissionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PatientStoryTest {

    private static final UUID PATIENT_ID = UUID.fromString("a0e0b36e-b9c5-4f95-8bd6-4474c49de0e9");
    private static final UUID STAFF_ID = UUID.fromString("dcbb12c5-b7bb-437c-9cf0-8f747d2a2e19");

    @Test
    void searchResultProvidesThePatientIdUsedForTheDetailFetch() {
        Patient patient = patient();
        PatientService service = mock(PatientService.class);
        when(service.search("ngcobo")).thenReturn(List.of(patient));

        ResponseEntity<java.util.Map<String, Object>> response = new PatientController(service).search("ngcobo");

        @SuppressWarnings("unchecked")
        List<PatientController.PatientSummary> items =
                (List<PatientController.PatientSummary>) response.getBody().get("items");
        assertThat(items).singleElement().extracting(PatientController.PatientSummary::id).isEqualTo(PATIENT_ID);
    }

    @Test
    void selectedPatientDetailContainsEveryStoredDemographicField() {
        Patient patient = patient();
        PatientService service = mock(PatientService.class);
        when(service.get(PATIENT_ID)).thenReturn(patient);

        ResponseEntity<PatientController.PatientSummary> response = new PatientController(service).get(PATIENT_ID);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isEqualTo(new PatientController.PatientSummary(PATIENT_ID, "MPI-0000001",
                "Andile", "Ngcobo", LocalDate.of(1985, 1, 1), Gender.FEMALE,
                CitizenshipStatus.SA_CITIZEN, "8501011002085", "12 Main Road", "+27821234567",
                "Ubuntu Medical", "UM-123", Instant.parse("2026-08-25T08:00:00Z")));
    }

    @Test
    void editedPrePopulatedDemographicsAreAuditedWithBeforeAndAfterSnapshots() {
        PatientRepository repository = mock(PatientRepository.class);
        AuditLogService auditLog = mock(AuditLogService.class);
        PermissionService permissions = mock(PermissionService.class);
        Patient patient = patient();
        when(repository.findById(PATIENT_ID)).thenReturn(java.util.Optional.of(patient));

        PatientService service = new PatientService(repository, auditLog,
                Clock.fixed(Instant.parse("2026-08-25T08:00:00Z"), ZoneOffset.UTC), permissions, objectMapper());
        service.updateDemographics(PATIENT_ID, new PatientService.UpdatePatientCommand("Andile", "Ngcobo",
                "8501011002085", "15 Updated Road", "+27821234567", "Ubuntu Medical", "UM-123"), STAFF_ID);

        ArgumentCaptor<String> before = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> after = ArgumentCaptor.forClass(String.class);
        verify(auditLog).append(eq(STAFF_ID), eq(null), eq("PATIENT_UPDATED"), eq("Patient"),
                eq(PATIENT_ID.toString()), before.capture(), after.capture());
        assertThat(before.getValue()).contains("12 Main Road");
        assertThat(after.getValue()).contains("15 Updated Road");
        assertThat(patient.getAddress()).isEqualTo("15 Updated Road");
    }

    @Test
    void savingUnchangedPrePopulatedDemographicsDoesNotCreateAnAuditEvent() {
        PatientRepository repository = mock(PatientRepository.class);
        AuditLogService auditLog = mock(AuditLogService.class);
        PermissionService permissions = mock(PermissionService.class);
        Patient patient = patient();
        when(repository.findById(PATIENT_ID)).thenReturn(java.util.Optional.of(patient));

        PatientService service = new PatientService(repository, auditLog, Clock.systemUTC(), permissions,
                objectMapper());
        service.updateDemographics(PATIENT_ID, new PatientService.UpdatePatientCommand("Andile", "Ngcobo",
                "8501011002085", "12 Main Road", "+27821234567", "Ubuntu Medical", "UM-123"), STAFF_ID);

        verify(auditLog, never()).append(any(), any(), any(), any(), any(), any(), any());
    }

    private Patient patient() {
        Patient patient = new Patient("MPI-0000001", "Andile", "Ngcobo", LocalDate.of(1985, 1, 1),
                Gender.FEMALE, CitizenshipStatus.SA_CITIZEN, "8501011002085", "12 Main Road", "+27821234567",
                "Ubuntu Medical", "UM-123", STAFF_ID, Instant.parse("2026-08-25T08:00:00Z"));
        ReflectionTestUtils.setField(patient, "id", PATIENT_ID);
        return patient;
    }

    private ObjectMapper objectMapper() {
        return new ObjectMapper().findAndRegisterModules();
    }
}
