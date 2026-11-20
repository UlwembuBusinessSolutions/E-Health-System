package co.ehealth.platform.patient;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.facility.FacilityService;
import co.ehealth.platform.identity.Gender;
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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class IncomingReferralPatientWriterTest {

    private final PatientRepository patientRepository = mock(PatientRepository.class);
    private final OrganizationRepository organizationRepository = mock(OrganizationRepository.class);
    private final FacilityService facilityService = mock(FacilityService.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final IncomingReferralPatientWriter writer = new IncomingReferralPatientWriter(patientRepository,
            organizationRepository, facilityService, auditLogService,
            Clock.fixed(Instant.parse("2025-01-01T10:00:00Z"), ZoneOffset.UTC));

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    @Test
    void createsDestinationPatientWithTenantMpiAndAuditEntry() {
        UUID referralId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        UUID facilityId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        IncomingReferralService.IncomingPatient incoming = incoming(referralId);
        Organization organization = mock(Organization.class);
        when(patientRepository.findByIdNumber(incoming.idNumber())).thenReturn(Optional.empty());
        when(patientRepository.nextMpiSequenceValue()).thenReturn(38L);
        when(organizationRepository.findBySchemaName("destination")).thenReturn(Optional.of(organization));
        when(organization.getTenantCode()).thenReturn("DC");
        when(patientRepository.save(any(Patient.class))).thenAnswer(invocation -> {
            Patient patient = invocation.getArgument(0);
            ReflectionTestUtils.setField(patient, "id", patientId);
            return patient;
        });
        TenantContext.setCurrentTenant("destination");

        IncomingReferralService.PatientReceived result = writer.store(incoming, facilityId, actorId);

        assertEquals(patientId, result.patientId());
        assertEquals("DC-0000038", result.mpiNumber());
        assertEquals("Amina Ndlovu", result.patientName());
        assertFalse(result.alreadyRegistered());
        verify(facilityService).get(facilityId);
        verify(auditLogService).append(eq(actorId), eq(facilityId), eq("PATIENT_RECEIVED_VIA_REFERRAL"),
                eq("Patient"), eq(patientId.toString()), eq(null), eq("{\"referralId\":\"" + referralId + "\"}"));
    }

    @Test
    void reusesAnExistingActivePatientWithoutCreatingAnotherRecord() {
        UUID facilityId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        IncomingReferralService.IncomingPatient incoming = incoming(UUID.randomUUID());
        Patient existing = mock(Patient.class);
        when(patientRepository.findByIdNumber(incoming.idNumber())).thenReturn(Optional.of(existing));
        when(existing.isArchived()).thenReturn(false);
        when(existing.getId()).thenReturn(patientId);
        when(existing.getMpiNumber()).thenReturn("DC-0000003");
        when(existing.getFirstName()).thenReturn("Amina");
        when(existing.getLastName()).thenReturn("Ndlovu");
        TenantContext.setCurrentTenant("destination");

        IncomingReferralService.PatientReceived result = writer.store(incoming, facilityId, actorId);

        assertEquals(patientId, result.patientId());
        assertEquals("DC-0000003", result.mpiNumber());
        assertTrue(result.alreadyRegistered());
        verify(patientRepository, never()).save(any(Patient.class));
        verify(auditLogService, never()).append(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void rejectsAnArchivedDestinationRecordForManualReconciliation() {
        UUID facilityId = UUID.randomUUID();
        IncomingReferralService.IncomingPatient incoming = incoming(UUID.randomUUID());
        Patient existing = mock(Patient.class);
        when(patientRepository.findByIdNumber(incoming.idNumber())).thenReturn(Optional.of(existing));
        when(existing.isArchived()).thenReturn(true);
        TenantContext.setCurrentTenant("destination");

        assertThrows(PatientAlreadyExistsAtDestinationException.class,
                () -> writer.store(incoming, facilityId, UUID.randomUUID()));

        verify(patientRepository, never()).save(any(Patient.class));
    }

    private IncomingReferralService.IncomingPatient incoming(UUID referralId) {
        return new IncomingReferralService.IncomingPatient(referralId, "9001015009087", "Amina", "Ndlovu",
                LocalDate.of(1990, 1, 1), Gender.FEMALE, CitizenshipStatus.SA_CITIZEN, "1 Main Street",
                "0712345678", "amina@example.org", null, null, null, null);
    }
}
