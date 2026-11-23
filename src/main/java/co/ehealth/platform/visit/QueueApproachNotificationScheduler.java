package co.ehealth.platform.visit;

import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.OrganizationStatus;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.facility.FacilityRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class QueueApproachNotificationScheduler {

    private static final Logger log = LoggerFactory.getLogger(QueueApproachNotificationScheduler.class);

    private final OrganizationRepository organizations;
    private final FacilityRepository facilities;
    private final QueueApproachNotificationService notifications;

    public QueueApproachNotificationScheduler(OrganizationRepository organizations, FacilityRepository facilities,
                                              QueueApproachNotificationService notifications) {
        this.organizations = organizations;
        this.facilities = facilities;
        this.notifications = notifications;
    }

        @Scheduled(fixedDelayString = "${app.notifications.queue-scan-delay-ms:60000}",
            initialDelayString = "${app.notifications.queue-scan-initial-delay-ms:60000}")
    public void scanActiveQueues() {
        for (Organization organization : organizations.findAll()) {
            if (organization.getStatus() != OrganizationStatus.ACTIVE) {
                continue;
            }
            TenantContext.setCurrentTenant(organization.getSchemaName());
            try {
                facilities.findAll().stream().filter(facility -> facility.isActive())
                        .forEach(facility -> notifications.evaluateFacility(facility.getId()));
            } catch (RuntimeException ex) {
                log.warn("Could not scan queue approach notifications for tenant {}", organization.getSchemaName(), ex);
            } finally {
                TenantContext.clear();
            }
        }
    }
}