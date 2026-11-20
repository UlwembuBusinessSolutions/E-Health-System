package co.ehealth.platform.patient;

import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class ReferralNotificationService {

    private final ReferralNotificationRepository notificationRepository;
    private final ReferralNotificationAcknowledgementRepository acknowledgementRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final ReferralDestinationService destinationService;
    private final IncomingReferralService incomingReferralService;
    private final IncomingReferralPatientWriter incomingPatientWriter;
    private final PermissionService permissionService;
    private final Clock clock;

    public ReferralNotificationService(ReferralNotificationRepository notificationRepository,
                                       ReferralNotificationAcknowledgementRepository acknowledgementRepository,
                                       OrganizationRepository organizationRepository, UserRepository userRepository,
                                       ReferralDestinationService destinationService,
                                       IncomingReferralService incomingReferralService,
                                       IncomingReferralPatientWriter incomingPatientWriter,
                                       PermissionService permissionService, Clock clock) {
        this.notificationRepository = notificationRepository;
        this.acknowledgementRepository = acknowledgementRepository;
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
        this.destinationService = destinationService;
        this.incomingReferralService = incomingReferralService;
        this.incomingPatientWriter = incomingPatientWriter;
        this.permissionService = permissionService;
        this.clock = clock;
    }

    private static final Set<String> CLINICAL_ROLES =
            Set.of("Professional Nurse", "Doctor", "Clinician", "Occupational Health Practitioner");

    @Transactional
    public void createForSubmittedReferral(PatientReferral referral) {
        UUID destinationFacilityId = referral.getDestinationFacilityId();
        if (destinationFacilityId == null) {
            return;
        }

        String sourceSchema = TenantContext.getCurrentTenant();
        if (sourceSchema == null || sourceSchema.isBlank()) {
            throw new IllegalStateException("Cannot create a referral notification outside a tenant request.");
        }
        if (notificationRepository.existsBySourceSchemaAndSourceReferralId(sourceSchema, referral.getId())) {
            return;
        }

        Organization sourceOrganization = organizationRepository.findBySchemaName(sourceSchema)
                .orElseThrow(() -> new IllegalStateException("The source organization could not be resolved."));
        PatientReferralService.ReferralDestination destination =
                destinationService.getActiveDestination(destinationFacilityId);
        notificationRepository.save(new ReferralNotification(sourceOrganization.getId(), sourceSchema,
                sourceOrganization.getDisplayName(), referral.getId(), destination.organizationId(),
                destination.facilityId(), referral.getReferralType(), clock.instant()));
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public List<ReferralNotificationResponse> listForUser(UUID userId) {
        Organization organization = currentOrganization();
        List<UUID> facilityIds = userRepository.findFacilityIdsByUserId(userId);
        if (facilityIds.isEmpty()) {
            return List.of();
        }
        List<ReferralNotification> notifications =
                notificationRepository.findForUser(organization.getId(), facilityIds);
        if (notifications.isEmpty()) {
            return List.of();
        }
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        Set<UUID> acknowledgedIds = Set.copyOf(acknowledgementRepository.findAcknowledgedNotificationIds(
                userId, notifications.stream().map(ReferralNotification::getId).toList()));
        return notifications.stream().map(notification -> {
            IncomingReferralService.ReferralSummary summary = referralSummary(notification);
            return ReferralNotificationResponse.from(notification,
                    acknowledgedIds.contains(notification.getId()), summary.status(), summary.patientName());
        }).toList();
    }

    private IncomingReferralService.ReferralSummary referralSummary(ReferralNotification notification) {
        String originSchema = TenantContext.getCurrentTenant();
        try {
            TenantContext.setCurrentTenant(notification.getSourceSchema());
            return incomingReferralService.getSummary(notification);
        } finally {
            TenantContext.setCurrentTenant(originSchema);
        }
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public ReferralNotificationDetail getDetails(UUID notificationId, UUID userId) {
        ReferralNotification notification = requireAssignedNotification(notificationId, userId);
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        String originSchema = TenantContext.getCurrentTenant();
        try {
            TenantContext.setCurrentTenant(notification.getSourceSchema());
            return incomingReferralService.getDetails(notification);
        } finally {
            TenantContext.setCurrentTenant(originSchema);
        }
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public IncomingReferralService.PatientReceived accept(UUID notificationId, UUID userId) {
        ReferralNotification notification = requireAssignedNotification(notificationId, userId);
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        permissionService.requireAnyRole(CLINICAL_ROLES, "Only clinical staff may accept patient referrals.");
        List<UUID> facilityIds = userRepository.findFacilityIdsByUserId(userId);
        if (!facilityIds.contains(notification.getDestinationFacilityId())) {
            throw new AccessDeniedException("You are not assigned to the destination clinic.");
        }

        String originSchema = TenantContext.getCurrentTenant();
        IncomingReferralService.IncomingPatient incomingPatient;
        try {
            TenantContext.setCurrentTenant(notification.getSourceSchema());
            incomingPatient = incomingReferralService.getPatientForReceiving(notification);
        } finally {
            TenantContext.setCurrentTenant(originSchema);
        }

        IncomingReferralService.PatientReceived receivedPatient =
                incomingPatientWriter.store(incomingPatient, notification.getDestinationFacilityId(), userId);

        try {
            TenantContext.setCurrentTenant(notification.getSourceSchema());
            incomingReferralService.accept(notification, userId);
        } finally {
            TenantContext.setCurrentTenant(originSchema);
        }
        return receivedPatient;
    }

    @Transactional
    public void acknowledge(UUID notificationId, UUID userId) {
        requireAssignedNotification(notificationId, userId);
        acknowledgementRepository.acknowledge(notificationId, userId, clock.instant());
    }

    private ReferralNotification requireAssignedNotification(UUID notificationId, UUID userId) {
        Organization organization = currentOrganization();
        List<UUID> facilityIds = userRepository.findFacilityIdsByUserId(userId);
        if (facilityIds.isEmpty()) {
            throw new AccessDeniedException("You are not assigned to the destination clinic.");
        }
        return notificationRepository.findByIdAndDestinationOrganizationIdAndDestinationFacilityIdIn(
                        notificationId, organization.getId(), facilityIds)
                .orElseThrow(() -> new AccessDeniedException("You are not assigned to this notification's clinic."));
    }

    private Organization currentOrganization() {
        String schema = TenantContext.getCurrentTenant();
        if (schema == null || schema.isBlank()) {
            throw new IllegalStateException("Referral notifications require a tenant request.");
        }
        return organizationRepository.findBySchemaName(schema)
                .orElseThrow(() -> new IllegalStateException("The current organization could not be resolved."));
    }

    public record ReferralNotificationResponse(UUID id, String sourceOrganizationName, String patientName,
                                              PatientReferralType referralType, java.time.Instant createdAt,
                                              PatientReferralStatus status, boolean acknowledged) {
        static ReferralNotificationResponse from(ReferralNotification notification, boolean acknowledged,
                                                 PatientReferralStatus status, String patientName) {
            return new ReferralNotificationResponse(notification.getId(), notification.getSourceOrganizationName(),
                    patientName, notification.getReferralType(), notification.getCreatedAt(), status, acknowledged);
        }
    }

    public record ReferralNotificationDetail(UUID notificationId, String sourceOrganizationName, UUID referralId,
                                             UUID patientId, PatientReferralType referralType,
                                             PatientReferralStatus status, java.time.LocalDate referralDate,
                                             String institutionName, String reason, String clinicalSummary,
                                             String requiredMedication, String medicationInstructions,
                                             String additionalNotes, String patientMpiNumber, String patientName,
                                             java.time.LocalDate patientDateOfBirth,
                                             co.ehealth.platform.identity.Gender patientGender,
                                             String patientContactNumber) {
    }
}
