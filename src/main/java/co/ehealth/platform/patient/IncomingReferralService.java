package co.ehealth.platform.patient;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;

@Service
public class IncomingReferralService {

    private final PatientReferralRepository referralRepository;
    private final PatientRepository patientRepository;
    private final PatientReferralEventRepository eventRepository;
    private final Clock clock;

    public IncomingReferralService(PatientReferralRepository referralRepository, PatientRepository patientRepository,
                                   PatientReferralEventRepository eventRepository, Clock clock) {
        this.referralRepository = referralRepository;
        this.patientRepository = patientRepository;
        this.eventRepository = eventRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public ReferralNotificationService.ReferralNotificationDetail getDetails(ReferralNotification notification) {
        PatientReferral referral = findReferral(notification);
        Patient patient = patientRepository.findById(referral.getPatientId())
                .orElseThrow(PatientReferralNotFoundException::new);
        return new ReferralNotificationService.ReferralNotificationDetail(notification.getId(),
                notification.getSourceOrganizationName(), referral.getId(), referral.getPatientId(),
                referral.getReferralType(), referral.getStatus(), referral.getReferralDate(),
                referral.getInstitutionName(), referral.getReason(), referral.getClinicalSummary(),
                referral.getRequiredMedication(), referral.getMedicationInstructions(), referral.getAdditionalNotes(),
                patient.getMpiNumber(), patient.getFirstName() + " " + patient.getLastName(),
                patient.getDateOfBirth(), patient.getGender(), patient.getContactNumber());
    }

    @Transactional(readOnly = true)
    public ReferralSummary getSummary(ReferralNotification notification) {
        PatientReferral referral = findReferral(notification);
        Patient patient = patientRepository.findById(referral.getPatientId())
                .orElseThrow(PatientReferralNotFoundException::new);
        return new ReferralSummary(referral.getStatus(), patient.getFirstName() + " " + patient.getLastName());
    }

    @Transactional
    public void accept(ReferralNotification notification, java.util.UUID actorId) {
        PatientReferral referral = findReferral(notification);
        if (referral.getStatus() == PatientReferralStatus.ACCEPTED) {
            return;
        }
        if (referral.getStatus() != PatientReferralStatus.SUBMITTED) {
            throw new InvalidPatientReferralException("Only a submitted referral can be accepted.");
        }
        java.time.Instant now = clock.instant();
        referral.changeStatus(PatientReferralStatus.ACCEPTED, now);
        referralRepository.save(referral);
        eventRepository.save(new PatientReferralEvent(referral.getId(), PatientReferralStatus.SUBMITTED,
                PatientReferralStatus.ACCEPTED, actorId, "Accepted by destination clinic", now));
    }

    @Transactional(readOnly = true)
    public IncomingPatient getPatientForReceiving(ReferralNotification notification) {
        PatientReferral referral = findReferral(notification);
        if (referral.getStatus() != PatientReferralStatus.SUBMITTED
                && referral.getStatus() != PatientReferralStatus.ACCEPTED) {
            throw new InvalidPatientReferralException("Only submitted referrals can be accepted.");
        }
        Patient patient = patientRepository.findById(referral.getPatientId())
                .orElseThrow(PatientNotFoundException::new);
        return new IncomingPatient(referral.getId(), patient.getIdNumber(), patient.getFirstName(),
                patient.getLastName(), patient.getDateOfBirth(), patient.getGender(), patient.getCitizenshipStatus(),
                patient.getAddress(), patient.getContactNumber(), patient.getEmail(), patient.getMedicalAidProvider(),
                patient.getMedicalAidNumber(), patient.getPassportNumber(), patient.getPassportExpiry());
    }

    private PatientReferral findReferral(ReferralNotification notification) {
        PatientReferral referral = referralRepository.findById(notification.getSourceReferralId())
                .orElseThrow(PatientReferralNotFoundException::new);
        if (!notification.getDestinationFacilityId().equals(referral.getDestinationFacilityId())) {
            throw new PatientReferralNotFoundException();
        }
        return referral;
    }

    public record IncomingPatient(UUID referralId, String idNumber, String firstName, String lastName,
                                  LocalDate dateOfBirth, co.ehealth.platform.identity.Gender gender,
                                  CitizenshipStatus citizenshipStatus, String address, String contactNumber,
                                  String email, String medicalAidProvider, String medicalAidNumber,
                                  String passportNumber, LocalDate passportExpiry) {
    }

    public record ReferralSummary(PatientReferralStatus status, String patientName) {
    }

    public record PatientReceived(UUID patientId, String mpiNumber, String patientName, boolean alreadyRegistered) {
    }
}
