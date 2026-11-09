package co.ehealth.platform.patient;

import co.ehealth.platform.appointment.AppointmentService;
import co.ehealth.platform.core.security.PatientPrincipal;
import co.ehealth.platform.facility.FacilityRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class PatientBookingServiceTest {
    private final PatientAccountRepository accounts = mock(PatientAccountRepository.class);
    private final FacilityRepository facilities = mock(FacilityRepository.class);
    private final AppointmentService appointments = mock(AppointmentService.class);
    private final PatientBookingService service = new PatientBookingService(accounts, facilities, appointments);

    @Test
    void bookingUsesTheAuthenticatedAccountsPatientLink() {
        UUID accountId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        UUID facilityId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        UUID providerId = UUID.randomUUID();
        PatientAccount account = new PatientAccount("8001015009087", "patient@example.com", "Alex", "Patient",
                "hash", patientId, Instant.parse("2026-10-01T00:00:00Z"));
        org.springframework.test.util.ReflectionTestUtils.setField(account, "id", accountId);
        when(accounts.findById(accountId)).thenReturn(java.util.Optional.of(account));

        service.book(new PatientPrincipal(accountId, "jti"), requestId, facilityId, "FOLLOW_UP", providerId,
                LocalDate.of(2026, 11, 1), LocalTime.of(9, 30));

        verify(appointments).bookFromPatientPortal(facilityId, requestId, patientId, accountId,
                LocalDate.of(2026, 11, 1), LocalTime.of(9, 30), providerId, "FOLLOW_UP");
    }

    @Test
    void unlinkedAccountCannotBookForAnyPatient() {
        UUID accountId = UUID.randomUUID();
        PatientAccount account = new PatientAccount("8001015009087", "patient@example.com", "Alex", "Patient",
                "hash", null, Instant.parse("2026-10-01T00:00:00Z"));
        when(accounts.findById(accountId)).thenReturn(java.util.Optional.of(account));

        assertThrows(PatientNotFoundException.class, () -> service.book(
                new PatientPrincipal(accountId, "jti"), UUID.randomUUID(), UUID.randomUUID(), "FOLLOW_UP", null,
                LocalDate.of(2026, 11, 1), LocalTime.of(9, 30)));
        verifyNoInteractions(appointments);
    }
}
