package co.ehealth.platform.patient;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityService;
import co.ehealth.platform.identity.Gender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PatientMigrationWriterTest {

    private final PatientRepository patientRepository = mock(PatientRepository.class);
    private final PatientDocumentService patientDocumentService = mock(PatientDocumentService.class);
    private final PatientMigrationRepository migrationRepository = mock(PatientMigrationRepository.class);
    private final FacilityService facilityService = mock(FacilityService.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    @Test
    void destinationAuditUsesNoCrossTenantUserId() {
        UUID originActorId = UUID.randomUUID();
        UUID facilityId = UUID.randomUUID();
        UUID destinationPatientId = UUID.randomUUID();
        Facility facility = mock(Facility.class);
        when(facility.getName()).thenReturn("Ulwembu");
        when(facility.getAddress()).thenReturn("1 Main Road");
        when(facilityService.get(facilityId)).thenReturn(facility);
        when(patientRepository.findByIdNumber("9001015009087")).thenReturn(Optional.empty());
        when(patientRepository.nextMpiSequenceValue()).thenReturn(12L);
        when(patientRepository.save(any(Patient.class))).thenAnswer(invocation -> {
            Patient patient = invocation.getArgument(0);
            ReflectionTestUtils.setField(patient, "id", destinationPatientId);
            return patient;
        });
        TenantContext.setCurrentTenant("ulwembu");

        PatientMigrationWriter writer = new PatientMigrationWriter(patientRepository, patientDocumentService,
                migrationRepository, facilityService, auditLogService);
        writer.writeDestination(new PatientMigrationWriter.DestinationWriteCommand(
                "ULW", facilityId, "Amina", "Ndlovu", LocalDate.of(1990, 1, 1),
                Gender.FEMALE, CitizenshipStatus.SA_CITIZEN, "9001015009087",
                "1 Main Road", "0712345678", "amina@example.org", null, null, null, null,
                null, null, originActorId, List.of(), Instant.parse("2026-11-23T13:00:00Z")));

        verify(auditLogService).append(eq(null), eq(facilityId), eq("PATIENT_RECEIVED_VIA_MIGRATION"),
                eq("Patient"), eq(destinationPatientId.toString()), eq(null), eq(null));
    }
}
