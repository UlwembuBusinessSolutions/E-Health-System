package co.ehealth.platform.patient;

import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.UserRepository;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.services.s3.S3Client;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PatientReferralServiceTest {
    private final PatientService patientService = mock(PatientService.class);
    private final PatientReferralRepository referralRepository = mock(PatientReferralRepository.class);
    private final PatientReferralEventRepository eventRepository = mock(PatientReferralEventRepository.class);
    private final PatientReferralDocumentRepository documentRepository = mock(PatientReferralDocumentRepository.class);
    private final PermissionService permissionService = mock(PermissionService.class);
    private final ReferralDestinationService destinationService = mock(ReferralDestinationService.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final ReferralNotificationService notificationService = mock(ReferralNotificationService.class);
    private final PatientReferralDocumentAccessService documentAccessService =
            mock(PatientReferralDocumentAccessService.class);
    private final PatientReferralService service = new PatientReferralService(patientService, referralRepository,
            eventRepository, documentRepository, permissionService, destinationService, userRepository,
            notificationService, documentAccessService, mock(S3Client.class), "test-bucket", Clock.systemUTC());

    @Test
    void submittedReferralCannotBeEdited() {
        UUID patientId = UUID.randomUUID();
        UUID referralId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        Patient patient = mock(Patient.class);
        when(patientService.get(patientId)).thenReturn(patient);
        when(referralRepository.findByIdAndPatientId(referralId, patientId))
                .thenReturn(Optional.of(newSubmittedReferral(patientId)));

        assertThrows(InvalidPatientReferralException.class, () -> service.updateDraft(patientId, referralId,
                actorId, new PatientReferralService.ReferralCommand(PatientReferralType.REFERRAL, null, null, null,
                        null, null, LocalDate.now(), null, null, null, null, null)));

        verify(referralRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void submittingDraftCreatesIncomingNotification() {
        UUID patientId = UUID.randomUUID();
        UUID referralId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        Patient patient = mock(Patient.class);
        PatientReferral referral = new PatientReferral(patientId, PatientReferralType.TRANSFER, UUID.randomUUID(),
                "Receiving clinic", null, null, null, LocalDate.now(), "Reason", "Summary", null, null, null,
                actorId, Instant.now());
        when(patientService.get(patientId)).thenReturn(patient);
        when(referralRepository.findByIdAndPatientId(referralId, patientId)).thenReturn(Optional.of(referral));

        service.changeStatus(patientId, referralId, actorId, PatientReferralStatus.SUBMITTED, null);

        verify(notificationService).createForSubmittedReferral(referral);
    }

    @Test
    void doesNotCreateNotificationForAnAlreadySubmittedReferral() {
        UUID patientId = UUID.randomUUID();
        UUID referralId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        Patient patient = mock(Patient.class);
        when(patientService.get(patientId)).thenReturn(patient);
        when(referralRepository.findByIdAndPatientId(referralId, patientId))
                .thenReturn(Optional.of(newSubmittedReferral(patientId)));

        assertThrows(InvalidPatientReferralException.class, () -> service.changeStatus(patientId, referralId,
                actorId, PatientReferralStatus.SUBMITTED, null));

        verify(notificationService, never()).createForSubmittedReferral(org.mockito.ArgumentMatchers.any());
    }

    private PatientReferral newSubmittedReferral(UUID patientId) {
        PatientReferral referral = new PatientReferral(patientId, PatientReferralType.REFERRAL, null, null, null,
                null, null, LocalDate.now(), null, null, null, null, null, UUID.randomUUID(), Instant.now());
        referral.changeStatus(PatientReferralStatus.SUBMITTED, Instant.now());
        return referral;
    }
}
