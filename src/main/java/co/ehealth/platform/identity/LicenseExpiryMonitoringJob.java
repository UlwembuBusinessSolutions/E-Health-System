package co.ehealth.platform.identity;

import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;

/**
 * Checks every tenant's professional registrations once an hour.  The actual
 * permission decision is still made synchronously by StaffService for every
 * prescribe/dispense request; that prevents a user whose registration has
 * just expired from retaining access until this job's next run.
 */
@Component
public class LicenseExpiryMonitoringJob {

    private static final Logger log = LoggerFactory.getLogger(LicenseExpiryMonitoringJob.class);

    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final Clock clock;

    public LicenseExpiryMonitoringJob(OrganizationRepository organizationRepository,
                                      UserRepository userRepository, Clock clock) {
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
        this.clock = clock;
    }

    @Scheduled(cron = "${app.licensing.expiry-monitor-cron:0 0 * * * *}")
    public void monitorExpiredLicenses() {
        for (Organization organization : organizationRepository.findAll()) {
            monitorTenant(organization);
        }
    }

    // Package-visible so the tenant-specific behaviour is directly testable
    // without having to wait for, or invoke, Spring's scheduler.
    void monitorTenant(Organization organization) {
        String previousTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.setCurrentTenant(organization.getSchemaName());
            LocalDate today = LocalDate.now(clock);
            long expiredRegistrations = userRepository.findAll().stream()
                    .mapToLong(user -> expiredRegistrationCount(user, today))
                    .sum();
            if (expiredRegistrations > 0) {
                log.warn("Tenant {} has {} expired professional registration(s); affected prescribing and "
                                + "dispensing capabilities are suspended.",
                        organization.getSlug(), expiredRegistrations);
            }
        } finally {
            if (previousTenant == null) {
                TenantContext.clear();
            } else {
                TenantContext.setCurrentTenant(previousTenant);
            }
        }
    }

    private long expiredRegistrationCount(User user, LocalDate today) {
        return expired(user.getHpcsaNumber(), user.getHpcsaExpiryDate(), today)
                + expired(user.getSancNumber(), user.getSancExpiryDate(), today)
                + expired(user.getSapcNumber(), user.getSapcExpiryDate(), today);
    }

    private int expired(String number, LocalDate expiryDate, LocalDate today) {
        return number != null && !number.isBlank() && expiryDate != null && expiryDate.isBefore(today) ? 1 : 0;
    }
}
