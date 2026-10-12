package co.ehealth.platform.patient;

import co.ehealth.platform.core.security.PatientPrincipal;
import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.identity.Gender;
import co.ehealth.platform.visit.Visit;
import co.ehealth.platform.visit.VisitRepository;
import co.ehealth.platform.visit.VisitType;
import co.ehealth.platform.visit.ServiceStream;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class PatientPortalServiceTest {
    private final PatientAccountRepository accounts = mock(PatientAccountRepository.class);
    private final PatientRepository patients = mock(PatientRepository.class);
    private final VisitRepository visits = mock(VisitRepository.class);
    private final FacilityRepository facilities = mock(FacilityRepository.class);
    private final PatientPortalService service = new PatientPortalService(accounts, patients, visits, facilities);

    @Test
    void ownRecordsAreResolvedOnlyFromTheAuthenticatedAccount() {
        UUID accountId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        UUID facilityId = UUID.randomUUID();
        UUID visitId = UUID.randomUUID();
        PatientAccount account = new PatientAccount("8001015009087", "patient@example.com", "Alex", "Patient",
                "hash", patientId, Instant.parse("2026-10-01T00:00:00Z"));
        Patient patient = new Patient("MPI-001", "Alex", "Patient", LocalDate.of(1980, 1, 1), Gender.MALE,
                CitizenshipStatus.SA_CITIZEN, "8001015009087", "1 Main Street", "+27821234567",
                "patient@example.com", null, null, null, null, null, Instant.parse("2026-10-01T00:00:00Z"));
        Visit visit = new Visit(patientId, facilityId, VisitType.NEW, ServiceStream.GENERAL,
                Instant.parse("2026-10-02T08:00:00Z"), null);
        org.springframework.test.util.ReflectionTestUtils.setField(visit, "id", visitId);
        Facility facility = mock(Facility.class);
        when(facility.getId()).thenReturn(facilityId);
        when(facility.getName()).thenReturn("Central Clinic");
        when(accounts.findById(accountId)).thenReturn(Optional.of(account));
        when(patients.findById(patientId)).thenReturn(Optional.of(patient));
        when(visits.findByPatientIdOrderByVisitDateTimeDesc(patientId)).thenReturn(List.of(visit));
        when(facilities.findAllById(org.mockito.ArgumentMatchers.<Iterable<UUID>>any()))
                .thenReturn(List.of(facility));

        PatientPortalService.OwnRecords result = service.getOwnRecords(new PatientPrincipal(accountId, "jti"));

        assertEquals("MPI-001", result.mpiNumber());
        assertEquals("Central Clinic", result.visits().get(0).facilityName());
        verify(accounts).findById(accountId);
        verify(patients).findById(patientId);
        verify(visits).findByPatientIdOrderByVisitDateTimeDesc(patientId);
    }

    @Test
    void unlinkedAccountCannotReadAnyPatientRecord() {
        UUID accountId = UUID.randomUUID();
        PatientAccount account = new PatientAccount("8001015009087", "patient@example.com", "Alex", "Patient",
                "hash", null, Instant.parse("2026-10-01T00:00:00Z"));
        when(accounts.findById(accountId)).thenReturn(Optional.of(account));

        assertThrows(PatientNotFoundException.class,
                () -> service.getOwnRecords(new PatientPrincipal(accountId, "jti")));
        verifyNoInteractions(patients, visits, facilities);
    }
}
