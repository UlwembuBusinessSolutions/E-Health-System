package co.ehealth.platform.patient;

import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReferralNotificationServiceTest {

    private final ReferralNotificationRepository notificationRepository = mock(ReferralNotificationRepository.class);
    private final ReferralNotificationAcknowledgementRepository acknowledgementRepository =
            mock(ReferralNotificationAcknowledgementRepository.class);
    private final OrganizationRepository organizationRepository = mock(OrganizationRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final ReferralDestinationService destinationService = mock(ReferralDestinationService.class);
    private final IncomingReferralService incomingReferralService = mock(IncomingReferralService.class);
    private final IncomingReferralPatientWriter incomingPatientWriter = mock(IncomingReferralPatientWriter.class);
    private final PermissionService permissionService = mock(PermissionService.class);
    private final ReferralNotificationService service = new ReferralNotificationService(notificationRepository,
            acknowledgementRepository, organizationRepository, userRepository, destinationService,
            incomingReferralService, incomingPatientWriter, permissionService,
            Clock.fixed(Instant.parse("2025-01-01T10:00:00Z"), ZoneOffset.UTC));

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    @Test
    void listsNotificationsForTheCurrentOrganizationAndAssignedFacilities() {
        UUID organizationId = UUID.randomUUID();
        UUID facilityId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID notificationId = UUID.randomUUID();
        Organization organization = mock(Organization.class);
        ReferralNotification notification = mock(ReferralNotification.class);
        when(organization.getId()).thenReturn(organizationId);
        when(organizationRepository.findBySchemaName("destination")).thenReturn(Optional.of(organization));
        when(userRepository.findFacilityIdsByUserId(userId)).thenReturn(List.of(facilityId));
        when(notificationRepository.findForUser(organizationId, List.of(facilityId))).thenReturn(List.of(notification));
        when(notification.getId()).thenReturn(notificationId);
        when(notification.getSourceSchema()).thenReturn("source");
        when(incomingReferralService.getSummary(notification)).thenAnswer(invocation -> {
            assertEquals("source", TenantContext.getCurrentTenant());
            return new IncomingReferralService.ReferralSummary(PatientReferralStatus.SUBMITTED, "Alex Patient");
        });
        when(acknowledgementRepository.findAcknowledgedNotificationIds(userId, List.of(notificationId)))
                .thenReturn(List.of());
        TenantContext.setCurrentTenant("destination");

        List<ReferralNotificationService.ReferralNotificationResponse> result = service.listForUser(userId);

        assertEquals(1, result.size());
        assertEquals(PatientReferralStatus.SUBMITTED, result.get(0).status());
        assertEquals("Alex Patient", result.get(0).patientName());
        assertFalse(result.get(0).acknowledged());
        assertEquals("destination", TenantContext.getCurrentTenant());
        verify(notificationRepository).findForUser(organizationId, List.of(facilityId));
        verify(permissionService).requireAccess(co.ehealth.platform.core.tenant.ModuleCode.RECQ,
                co.ehealth.platform.identity.PermissionLevel.VIEW);
    }

    @Test
    void keepsAcknowledgedNotificationsInTheList() {
        UUID organizationId = UUID.randomUUID();
        UUID facilityId = UUID.randomUUID();
        UUID notificationId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Organization organization = mock(Organization.class);
        ReferralNotification notification = mock(ReferralNotification.class);
        when(organization.getId()).thenReturn(organizationId);
        when(organizationRepository.findBySchemaName("destination")).thenReturn(Optional.of(organization));
        when(userRepository.findFacilityIdsByUserId(userId)).thenReturn(List.of(facilityId));
        when(notificationRepository.findForUser(organizationId, List.of(facilityId))).thenReturn(List.of(notification));
        when(notification.getId()).thenReturn(notificationId);
        when(notification.getSourceSchema()).thenReturn("source");
        when(incomingReferralService.getSummary(notification))
                .thenReturn(new IncomingReferralService.ReferralSummary(PatientReferralStatus.ACCEPTED, "Alex Patient"));
        when(acknowledgementRepository.findAcknowledgedNotificationIds(userId, List.of(notificationId)))
                .thenReturn(List.of(notificationId));
        TenantContext.setCurrentTenant("destination");

        List<ReferralNotificationService.ReferralNotificationResponse> result = service.listForUser(userId);

        assertEquals(1, result.size());
        assertEquals(notificationId, result.get(0).id());
        assertEquals(PatientReferralStatus.ACCEPTED, result.get(0).status());
        assertTrue(result.get(0).acknowledged());
    }

    @Test
    void acknowledgesAnAlertOnlyAfterCheckingItsDestinationClinicAssignment() {
        UUID organizationId = UUID.randomUUID();
        UUID facilityId = UUID.randomUUID();
        UUID notificationId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Organization organization = mock(Organization.class);
        when(organization.getId()).thenReturn(organizationId);
        when(organizationRepository.findBySchemaName("destination")).thenReturn(Optional.of(organization));
        when(userRepository.findFacilityIdsByUserId(userId)).thenReturn(List.of(facilityId));
        when(notificationRepository.findByIdAndDestinationOrganizationIdAndDestinationFacilityIdIn(
                notificationId, organizationId, List.of(facilityId))).thenReturn(Optional.of(mock(ReferralNotification.class)));
        TenantContext.setCurrentTenant("destination");

        service.acknowledge(notificationId, userId);

        verify(acknowledgementRepository).acknowledge(notificationId, userId,
                Instant.parse("2025-01-01T10:00:00Z"));
    }

    @Test
    void doesNotAllowAcknowledgingAnAlertForAnUnassignedClinic() {
        UUID notificationId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Organization organization = mock(Organization.class);
        when(organization.getId()).thenReturn(UUID.randomUUID());
        when(organizationRepository.findBySchemaName("destination")).thenReturn(Optional.of(organization));
        when(userRepository.findFacilityIdsByUserId(userId)).thenReturn(List.of());
        TenantContext.setCurrentTenant("destination");

        assertThrows(AccessDeniedException.class, () -> service.acknowledge(notificationId, userId));

        verify(notificationRepository, never()).findByIdAndDestinationOrganizationIdAndDestinationFacilityIdIn(
                any(), any(), any());
        verify(acknowledgementRepository, never()).acknowledge(any(), any(), any());
    }

    @Test
    void showsReferralAndPatientDetailsOnlyToStaffAssignedToTheDestinationClinic() {
        UUID organizationId = UUID.randomUUID();
        UUID facilityId = UUID.randomUUID();
        UUID notificationId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Organization organization = mock(Organization.class);
        ReferralNotification notification = mock(ReferralNotification.class);
        ReferralNotificationService.ReferralNotificationDetail expected =
                mock(ReferralNotificationService.ReferralNotificationDetail.class);
        when(organization.getId()).thenReturn(organizationId);
        when(organizationRepository.findBySchemaName("destination")).thenReturn(Optional.of(organization));
        when(userRepository.findFacilityIdsByUserId(userId)).thenReturn(List.of(facilityId));
        when(notificationRepository.findByIdAndDestinationOrganizationIdAndDestinationFacilityIdIn(
                notificationId, organizationId, List.of(facilityId))).thenReturn(Optional.of(notification));
        when(notification.getId()).thenReturn(notificationId);
        when(notification.getSourceSchema()).thenReturn("source");
        when(incomingReferralService.getDetails(notification)).thenAnswer(invocation -> {
            assertEquals("source", TenantContext.getCurrentTenant());
            return expected;
        });
        TenantContext.setCurrentTenant("destination");

        ReferralNotificationService.ReferralNotificationDetail result = service.getDetails(notificationId, userId);

        assertEquals(expected, result);
        assertEquals("destination", TenantContext.getCurrentTenant());
        verify(permissionService).requireAccess(co.ehealth.platform.core.tenant.ModuleCode.RECQ,
                co.ehealth.platform.identity.PermissionLevel.VIEW);
    }

    @Test
    void acceptsAnIncomingReferralOnlyForTheAssignedDestinationClinic() {
        UUID organizationId = UUID.randomUUID();
        UUID facilityId = UUID.randomUUID();
        UUID notificationId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Organization organization = mock(Organization.class);
        ReferralNotification notification = mock(ReferralNotification.class);
        when(organization.getId()).thenReturn(organizationId);
        when(organizationRepository.findBySchemaName("destination")).thenReturn(Optional.of(organization));
        when(userRepository.findFacilityIdsByUserId(userId)).thenReturn(List.of(facilityId));
        when(notificationRepository.findByIdAndDestinationOrganizationIdAndDestinationFacilityIdIn(
                notificationId, organizationId, List.of(facilityId))).thenReturn(Optional.of(notification));
        when(notification.getDestinationFacilityId()).thenReturn(facilityId);
        when(notification.getSourceSchema()).thenReturn("source");
        IncomingReferralService.IncomingPatient incoming = mock(IncomingReferralService.IncomingPatient.class);
        IncomingReferralService.PatientReceived expected =
                new IncomingReferralService.PatientReceived(UUID.randomUUID(), "DC-0000001", "Amina Ndlovu", false);
        when(incomingReferralService.getPatientForReceiving(notification)).thenAnswer(invocation -> {
            assertEquals("source", TenantContext.getCurrentTenant());
            return incoming;
        });
        when(incomingPatientWriter.store(incoming, facilityId, userId)).thenAnswer(invocation -> {
            assertEquals("destination", TenantContext.getCurrentTenant());
            return expected;
        });
        doAnswer(invocation -> {
            assertEquals("source", TenantContext.getCurrentTenant());
            return null;
        }).when(incomingReferralService).accept(notification, userId);
        TenantContext.setCurrentTenant("destination");

        IncomingReferralService.PatientReceived result = service.accept(notificationId, userId);

        assertEquals(expected, result);
        verify(permissionService).requireAccess(co.ehealth.platform.core.tenant.ModuleCode.RECQ,
                co.ehealth.platform.identity.PermissionLevel.MANAGE);
        verify(incomingPatientWriter).store(incoming, facilityId, userId);
        verify(incomingReferralService).accept(notification, userId);
        assertEquals("destination", TenantContext.getCurrentTenant());
    }
}
