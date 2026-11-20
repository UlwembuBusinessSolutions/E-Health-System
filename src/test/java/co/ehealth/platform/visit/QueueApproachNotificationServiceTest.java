package co.ehealth.platform.visit;

import co.ehealth.platform.core.notification.AwsSmsService;
import co.ehealth.platform.core.notification.WhatsAppCloudApiService;
import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.facility.FacilityType;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientRepository;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class QueueApproachNotificationServiceTest {

    @Test
    void convertsSouthAfricanMobileNumbersToE164() {
        assertEquals("+27821234567", QueueApproachNotificationService.toE164("082 123 4567"));
        assertEquals("+27821234567", QueueApproachNotificationService.toE164("27821234567"));
        assertEquals("+27821234567", QueueApproachNotificationService.toE164("+27821234567"));
    }

    @Test
    void rejectsMissingOrInvalidMobileNumbers() {
        assertNull(QueueApproachNotificationService.toE164(null));
        assertNull(QueueApproachNotificationService.toE164("082-123"));
        assertNull(QueueApproachNotificationService.toE164("011 123 4567"));
        assertNull(QueueApproachNotificationService.toE164("+27111234567"));
    }

    @Test
    void sendsWhatsAppOnlyAfterCommitWhenPatientHasOptedIn() {
        NotificationFixture fixture = new NotificationFixture(true);
        TransactionSynchronizationManager.initSynchronization();
        try {
            fixture.service.evaluateFacility(fixture.facilityId);

            assertNotNull(fixture.waitingToken.getApproachWhatsAppSentAt());
            List<TransactionSynchronization> callbacks = TransactionSynchronizationManager.getSynchronizations();
            callbacks.forEach(TransactionSynchronization::afterCommit);
            verify(fixture.whatsApp).sendApproachingTurn("+27821234567", 1, 18);
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void doesNotSendWhatsAppWhenPatientHasNotOptedIn() {
        NotificationFixture fixture = new NotificationFixture(false);
        fixture.service.evaluateFacility(fixture.facilityId);

        assertNull(fixture.waitingToken.getApproachWhatsAppSentAt());
        verify(fixture.whatsApp, never()).sendApproachingTurn(anyString(), anyInt(), anyInt());
    }

    private static final class NotificationFixture {
        private final UUID facilityId = UUID.randomUUID();
        private final WhatsAppCloudApiService whatsApp = mock(WhatsAppCloudApiService.class);
        private final QueueToken waitingToken;
        private final QueueApproachNotificationService service;

        private NotificationFixture(boolean optedIn) {
            Instant now = Instant.parse("2026-10-20T08:00:00Z");
            Clock clock = Clock.fixed(now, ZoneOffset.UTC);
            Facility facility = new Facility("Clinic", "CLINIC", FacilityType.CLINIC);
            QueueToken calledToken = new QueueToken(UUID.randomUUID(), facilityId, 17,
                    TokenPriority.NORMAL, false, now.minusSeconds(600), null);
            calledToken.call(now.minusSeconds(60));
            waitingToken = new QueueToken(UUID.randomUUID(), facilityId, 18,
                    TokenPriority.NORMAL, false, now.minusSeconds(30), null);

            QueueTokenRepository tokens = mock(QueueTokenRepository.class);
            VisitRepository visits = mock(VisitRepository.class);
            PatientRepository patients = mock(PatientRepository.class);
            FacilityRepository facilities = mock(FacilityRepository.class);
            AwsSmsService sms = mock(AwsSmsService.class);
            Patient patient = mock(Patient.class);
            Visit visit = mock(Visit.class);

            when(sms.isReadyToSend()).thenReturn(false);
            when(whatsApp.isReadyToSend()).thenReturn(true);
            when(facilities.findById(facilityId)).thenReturn(Optional.of(facility));
            when(tokens.lockQueueForApproachEvaluation(org.mockito.ArgumentMatchers.eq(facilityId),
                    org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                    .thenReturn(List.of(calledToken, waitingToken));
            when(tokens.findAverageCompletedServiceMinutes(facilityId)).thenReturn(5.0);
            when(visits.findById(waitingToken.getVisitId())).thenReturn(Optional.of(visit));
            when(visit.getPatientId()).thenReturn(UUID.randomUUID());
            when(patients.findById(org.mockito.ArgumentMatchers.any())).thenReturn(Optional.of(patient));
            when(patient.getContactNumber()).thenReturn("082 123 4567");
            when(patient.isWhatsAppOptedIn()).thenReturn(optedIn);
            when(whatsApp.sendApproachingTurn("+27821234567", 1, 18))
                    .thenReturn(CompletableFuture.completedFuture(true));

            service = new QueueApproachNotificationService(tokens, visits, patients, facilities, sms, whatsApp, clock);
        }
    }
}
