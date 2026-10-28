package co.ehealth.platform.patient;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.identity.PermissionService;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PatientRegistrationFieldsTest {

    @AfterEach
    void clearTenantContext() {
        TenantContext.clear();
    }

    @Test
    void registrationAcceptsOptionalRelationshipAndTextFileNumber() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            Validator validator = factory.getValidator();
            PatientController.RegisterPatientRequest request = request(
                    LocalDate.of(1990, 5, 15), ParentRelationship.MOTHER, "0012A45");

            assertTrue(validator.validate(request).isEmpty());
            assertEquals("0012A45", request.patientFileNumber());
            assertEquals(ParentRelationship.MOTHER, request.parentRelationship());
            assertTrue(validator.validate(request(LocalDate.of(1990, 5, 15), ParentRelationship.FATHER,
                    "0".repeat(100))).isEmpty());
            assertTrue(validator.validate(request(LocalDate.of(1990, 5, 15), null, null)).isEmpty());
        }
    }

    @Test
    void registrationRequiresDateAndLimitsFileNumberLength() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            Validator validator = factory.getValidator();
            assertTrue(validator.validate(request(null, null, null)).stream()
                    .anyMatch(violation -> violation.getPropertyPath().toString().equals("dateOfBirth")));
            assertTrue(validator.validate(request(LocalDate.of(1990, 5, 15), ParentRelationship.FATHER,
                    "x".repeat(101))).stream()
                    .anyMatch(violation -> violation.getPropertyPath().toString().equals("patientFileNumber")));
        }
    }

    @Test
    void servicePersistsSubmittedDateAndNewFieldsInsteadOfReplacingDateFromId() {
        PatientRepository patients = mock(PatientRepository.class);
        OrganizationRepository organizations = mock(OrganizationRepository.class);
        Organization organization = mock(Organization.class);
        when(patients.existsByIdNumber("8001015009087")).thenReturn(false);
        when(patients.nextMpiSequenceValue()).thenReturn(1L);
        when(organizations.findBySchemaName("test_tenant")).thenReturn(Optional.of(organization));
        when(organization.getTenantCode()).thenReturn("TEST");
        when(patients.save(any(Patient.class))).thenAnswer(invocation -> {
            Patient saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", UUID.randomUUID());
            return saved;
        });
        TenantContext.setCurrentTenant("test_tenant");
        PatientService service = new PatientService(patients, mock(PatientFieldHistoryRepository.class),
                mock(AuditLogService.class),
                Clock.fixed(Instant.parse("2026-10-28T00:00:00Z"), ZoneOffset.UTC),
                mock(PermissionService.class), organizations);

        Patient patient = service.register(new PatientService.RegisterPatientCommand(
                "Lindiwe", "Mokoena", "8001015009087", "Street", "+27821234567", null,
                null, null, null, null, LocalDate.of(1980, 1, 2), ParentRelationship.FATHER, "00A-57"), null);

        assertEquals(LocalDate.of(1980, 1, 2), patient.getDateOfBirth());
        assertEquals(ParentRelationship.FATHER, patient.getParentRelationship());
        assertEquals("00A-57", patient.getPatientFileNumber());
        PatientController.PatientSummary response = PatientController.PatientSummary.from(patient, false);
        assertEquals(LocalDate.of(1980, 1, 2), response.dateOfBirth());
        assertEquals(ParentRelationship.FATHER, response.parentRelationship());
        assertEquals("00A-57", response.patientFileNumber());
    }

    private static PatientController.RegisterPatientRequest request(LocalDate dateOfBirth,
            ParentRelationship parentRelationship, String patientFileNumber) {
        return new PatientController.RegisterPatientRequest("Lindiwe", "Mokoena", "8001015009087", "Street",
                "+27821234567", null, null, null, null, null, dateOfBirth, parentRelationship, patientFileNumber);
    }
}
