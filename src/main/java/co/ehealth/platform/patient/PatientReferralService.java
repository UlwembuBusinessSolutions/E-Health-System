package co.ehealth.platform.patient;

import co.ehealth.platform.core.common.InvalidFileTypeException;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.facility.FacilityType;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class PatientReferralService {

    private static final Set<String> REFERRAL_MANAGEMENT_ROLES =
            Set.of("ORG_ADMIN", "Professional Nurse", "Doctor", "Clinician", "Occupational Health Practitioner");
    private static final String ROLE_DENIED =
            "Only organization administrators or clinical staff may manage patient referrals.";
    private static final long MAX_FILE_SIZE = 5L * 1024 * 1024;
    private static final Map<String, String> ALLOWED_CONTENT_TYPES = Map.of(
            "application/pdf", "pdf",
            "image/jpeg", "jpg",
            "image/png", "png",
            "image/webp", "webp",
            "application/msword", "doc",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx",
            "text/plain", "txt");

    private final PatientService patientService;
    private final PatientReferralRepository referralRepository;
    private final PatientReferralEventRepository eventRepository;
    private final PatientReferralDocumentRepository documentRepository;
    private final PatientReferralDocumentAccessService documentAccessService;
    private final PermissionService permissionService;
    private final UserRepository userRepository;
    private final ReferralDestinationService destinationService;
    private final ReferralNotificationService notificationService;
    private final S3Client s3Client;
    private final String bucketName;
    private final Clock clock;

    public PatientReferralService(PatientService patientService, PatientReferralRepository referralRepository,
                                  PatientReferralEventRepository eventRepository,
                                  PatientReferralDocumentRepository documentRepository,
                                  PermissionService permissionService, ReferralDestinationService destinationService,
                                  UserRepository userRepository, ReferralNotificationService notificationService,
                                  PatientReferralDocumentAccessService documentAccessService, S3Client s3Client,
                                  @Value("${app.storage.bucket-name}") String bucketName, Clock clock) {
        this.patientService = patientService;
        this.referralRepository = referralRepository;
        this.eventRepository = eventRepository;
        this.documentRepository = documentRepository;
        this.documentAccessService = documentAccessService;
        this.permissionService = permissionService;
        this.userRepository = userRepository;
        this.destinationService = destinationService;
        this.notificationService = notificationService;
        this.s3Client = s3Client;
        this.bucketName = bucketName;
        this.clock = clock;
    }

    @Transactional
    public PatientReferral createDraft(UUID patientId, UUID actorId, ReferralCommand command) {
        requireReferralManage();
        requireEditablePatient(patientId);
        Instant now = clock.instant();
        PatientReferral referral = new PatientReferral(patientId, command.referralType(),
                command.destinationFacilityId(), command.institutionName(), command.contactPerson(),
                command.telephoneNumber(), normalizeFaxNumber(command.faxNumber()),
                command.referralDate() == null ? LocalDate.now(clock) : command.referralDate(), command.reason(),
                command.clinicalSummary(), command.requiredMedication(), command.medicationInstructions(),
                command.additionalNotes(), actorId, now);
        applyFacilityDefaults(referral);
        referral = referralRepository.save(referral);
        eventRepository.save(new PatientReferralEvent(referral.getId(), null, PatientReferralStatus.DRAFT,
                actorId, "Referral draft created", now));
        return referral;
    }

    @Transactional
    public PatientReferral updateDraft(UUID patientId, UUID referralId, UUID actorId, ReferralCommand command) {
        requireReferralManage();
        requireEditablePatient(patientId);
        PatientReferral referral = find(patientId, referralId);
        requireDraft(referral);
        referral.update(command.referralType(), command.destinationFacilityId(), command.institutionName(),
                command.contactPerson(), command.telephoneNumber(), normalizeFaxNumber(command.faxNumber()),
                command.referralDate() == null ? referral.getReferralDate() : command.referralDate(),
                command.reason(), command.clinicalSummary(), command.requiredMedication(),
                command.medicationInstructions(), command.additionalNotes(), clock.instant());
        applyFacilityDefaults(referral);
        return referralRepository.save(referral);
    }

    @Transactional
    public PatientReferral changeStatus(UUID patientId, UUID referralId, UUID actorId,
                                        PatientReferralStatus target, String note) {
        requireReferralManage();
        requireEditablePatient(patientId);
        PatientReferral referral = find(patientId, referralId);
        PatientReferralStatus current = referral.getStatus();
        if (target == PatientReferralStatus.ACCEPTED) {
            UUID destinationFacilityId = referral.getDestinationFacilityId();
            if (destinationFacilityId == null || !userRepository.isAssignedToFacility(actorId, destinationFacilityId)) {
                throw new AccessDeniedException("Only clinical staff at the destination facility may accept this referral.");
            }
        }
        validateTransition(referral, target);
        Instant now = clock.instant();
        referral.changeStatus(target, now);
        referralRepository.save(referral);
        eventRepository.save(new PatientReferralEvent(referral.getId(), current, target, actorId, note, now));
        if (target == PatientReferralStatus.SUBMITTED && current == PatientReferralStatus.DRAFT) {
            notificationService.createForSubmittedReferral(referral);
        }
        return referral;
    }

    public List<PatientReferral> list(UUID patientId) {
        requireView();
        patientService.get(patientId);
        return referralRepository.findByPatientIdOrderByReferralDateDescCreatedAtDesc(patientId);
    }

    public List<ReferralDestination> listDestinations() {
        requireView();
        return destinationService.listActiveDestinations();
    }

    public PatientReferral get(UUID patientId, UUID referralId) {
        requireView();
        patientService.get(patientId);
        return find(patientId, referralId);
    }

    public List<PatientReferralEvent> history(UUID patientId, UUID referralId) {
        requireView();
        find(patientId, referralId);
        return eventRepository.findByReferralIdOrderByOccurredAtAsc(referralId);
    }

    public List<PatientReferralDocument> documents(UUID patientId, UUID referralId) {
        requireView();
        PatientReferral referral = find(patientId, referralId);
        return documentAccessService.list(referral.getId());
    }

    @Transactional
    public PatientReferralDocument uploadDocument(UUID patientId, UUID referralId, UUID actorId, MultipartFile file) {
        requireReferralManage();
        requireEditablePatient(patientId);
        PatientReferral referral = find(patientId, referralId);
        requireDraft(referral);
        if (file == null || file.isEmpty()) {
            throw new InvalidFileTypeException("Choose a non-empty referral document to upload.");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new InvalidFileTypeException("Referral documents must be 5 MB or smaller.");
        }
        String contentType = file.getContentType();
        if (contentType == null || contentType.isBlank()) {
            throw new InvalidFileTypeException("The referral document type could not be determined.");
        }
        String extension = ALLOWED_CONTENT_TYPES.get(contentType);
        if (extension == null) {
            throw new InvalidFileTypeException("Only PDF, Word, text, JPEG, PNG, or WebP files are allowed.");
        }

        String key = "patient-referrals/%s/%s/%s.%s"
                .formatted(TenantContext.getCurrentTenant(), referralId, UUID.randomUUID(), extension);
        try {
            s3Client.putObject(PutObjectRequest.builder().bucket(bucketName).key(key)
                    .contentType(contentType).build(), RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read referral document", e);
        }

        String originalFilename = file.getOriginalFilename() == null ? "referral-document" : file.getOriginalFilename();
        if (originalFilename.length() > 255) {
            originalFilename = originalFilename.substring(originalFilename.length() - 255);
        }
        return documentRepository.save(new PatientReferralDocument(referralId, patientId, originalFilename,
                contentType, file.getSize(), key, actorId, clock.instant()));
    }

    public String getDocumentDownloadUrl(UUID patientId, UUID referralId, UUID documentId) {
        requireView();
        find(patientId, referralId);
        return documentAccessService.getDownloadUrl(patientId, referralId, documentId);
    }

    private void requireView() {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
    }

    private void requireReferralManage() {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        permissionService.requireAnyRole(REFERRAL_MANAGEMENT_ROLES, ROLE_DENIED);
    }

    private Patient requireEditablePatient(UUID patientId) {
        Patient patient = patientService.get(patientId);
        if (patient.isArchived()) {
            throw new PatientArchivedException();
        }
        return patient;
    }

    private PatientReferral find(UUID patientId, UUID referralId) {
        return referralRepository.findByIdAndPatientId(referralId, patientId)
                .orElseThrow(PatientReferralNotFoundException::new);
    }

    private void requireDraft(PatientReferral referral) {
        if (referral.getStatus() != PatientReferralStatus.DRAFT) {
            throw new InvalidPatientReferralException("Only draft referrals can be edited or have documents added.");
        }
    }

    private void applyFacilityDefaults(PatientReferral referral) {
        if (referral.getDestinationFacilityId() == null) {
            return;
        }
        ReferralDestination destination = destinationService.getActiveDestination(referral.getDestinationFacilityId());
        String institutionName = isBlank(referral.getInstitutionName()) ? destination.facilityName()
                + " — " + destination.organizationName()
                : referral.getInstitutionName();
        String telephoneNumber = isBlank(referral.getTelephoneNumber()) ? destination.telephoneNumber()
                : referral.getTelephoneNumber();
        if (!java.util.Objects.equals(institutionName, referral.getInstitutionName())
                || !java.util.Objects.equals(telephoneNumber, referral.getTelephoneNumber())) {
            referral.update(referral.getReferralType(), destination.facilityId(), institutionName,
                    referral.getContactPerson(), telephoneNumber, referral.getFaxNumber(), referral.getReferralDate(),
                    referral.getReason(), referral.getClinicalSummary(), referral.getRequiredMedication(),
                    referral.getMedicationInstructions(), referral.getAdditionalNotes(), clock.instant());
        }
    }

    private void validateTransition(PatientReferral referral, PatientReferralStatus target) {
        PatientReferralStatus current = referral.getStatus();
        boolean valid = switch (target) {
            case SUBMITTED -> current == PatientReferralStatus.DRAFT
                    && !isBlank(referral.getInstitutionName()) && !isBlank(referral.getReason())
                    && !isBlank(referral.getClinicalSummary());
            case ACCEPTED -> current == PatientReferralStatus.SUBMITTED;
            case COMPLETED -> current == PatientReferralStatus.ACCEPTED;
            case CANCELLED -> current == PatientReferralStatus.DRAFT || current == PatientReferralStatus.SUBMITTED
                    || current == PatientReferralStatus.ACCEPTED;
            case DRAFT -> false;
        };
        if (!valid) {
            if (target == PatientReferralStatus.SUBMITTED && current == PatientReferralStatus.DRAFT) {
                throw new InvalidPatientReferralException(
                        "A destination institution, reason, and clinical summary are required before submission.");
            }
            throw new InvalidPatientReferralException("Referral cannot move from " + current + " to " + target + ".");
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String normalizeFaxNumber(String value) {
        if (isBlank(value)) {
            return null;
        }
        String normalized = value.trim();
        if (Set.of("no", "none", "n/a", "na", "no fax").contains(normalized.toLowerCase())) {
            return null;
        }
        return normalized;
    }

    public record ReferralCommand(PatientReferralType referralType, UUID destinationFacilityId,
                                  String institutionName, String contactPerson, String telephoneNumber,
                                  String faxNumber, LocalDate referralDate, String reason, String clinicalSummary,
                                  String requiredMedication, String medicationInstructions, String additionalNotes) {
    }

    public record ReferralDestination(UUID facilityId, String facilityName, FacilityType facilityType,
                                      String telephoneNumber, UUID organizationId, String organizationName) {
    }
}
