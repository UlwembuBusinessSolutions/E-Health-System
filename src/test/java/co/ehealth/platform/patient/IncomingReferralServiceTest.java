package co.ehealth.platform.patient;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class IncomingReferralServiceTest {

    private final PatientReferralRepository referralRepository = mock(PatientReferralRepository.class);
    private final PatientRepository patientRepository = mock(PatientRepository.class);
    private final PatientReferralEventRepository eventRepository = mock(PatientReferralEventRepository.class);
    private final IncomingReferralService service = new IncomingReferralService(referralRepository, patientRepository,
            eventRepository, Clock.fixed(Instant.parse("2025-01-01T10:00:00Z"), ZoneOffset.UTC));

    @Test
    void loadsPatientDetailsForAnOlderCancelledReferral() {
        UUID referralId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        UUID facilityId = UUID.randomUUID();
        ReferralNotification notification = mock(ReferralNotification.class);
        PatientReferral referral = mock(PatientReferral.class);
        Patient patient = mock(Patient.class);
        when(notification.getId()).thenReturn(UUID.randomUUID());
        when(notification.getDestinationFacilityId()).thenReturn(facilityId);
        when(notification.getSourceReferralId()).thenReturn(referralId);
        when(notification.getSourceOrganizationName()).thenReturn("Source clinic");
        when(referralRepository.findById(referralId)).thenReturn(Optional.of(referral));
        when(referral.getDestinationFacilityId()).thenReturn(facilityId);
        when(referral.getStatus()).thenReturn(PatientReferralStatus.CANCELLED);
        when(referral.getPatientId()).thenReturn(patientId);
        when(patientRepository.findById(patientId)).thenReturn(Optional.of(patient));
        when(patient.getFirstName()).thenReturn("Amina");
        when(patient.getLastName()).thenReturn("Ndlovu");

        ReferralNotificationService.ReferralNotificationDetail result = service.getDetails(notification);

        assertEquals(PatientReferralStatus.CANCELLED, result.status());
        assertEquals("Amina Ndlovu", result.patientName());
        verify(patientRepository).findById(patientId);
    }

    @Test
    void doesNotAcceptAReferralThatIsNoLongerSubmitted() {
        UUID referralId = UUID.randomUUID();
        UUID facilityId = UUID.randomUUID();
        ReferralNotification notification = mock(ReferralNotification.class);
        PatientReferral referral = mock(PatientReferral.class);
        when(notification.getDestinationFacilityId()).thenReturn(facilityId);
        when(notification.getSourceReferralId()).thenReturn(referralId);
        when(referralRepository.findById(referralId)).thenReturn(Optional.of(referral));
        when(referral.getDestinationFacilityId()).thenReturn(facilityId);
        when(referral.getStatus()).thenReturn(PatientReferralStatus.CANCELLED);

        assertThrows(InvalidPatientReferralException.class, () -> service.accept(notification, UUID.randomUUID()));

        verify(referralRepository, never()).save(referral);
        verify(eventRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }
}
