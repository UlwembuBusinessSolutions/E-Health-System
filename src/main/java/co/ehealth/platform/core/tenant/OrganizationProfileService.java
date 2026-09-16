package co.ehealth.platform.core.tenant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// The tenant-self-service read/write half of OrganizationProfile — same
// "resolve the caller's own org from TenantContext" shape as
// OrganizationBrandingService/OrganizationMailSettingsService. Write access
// is enforced by OrganizationProfileController living under
// /api/v1/admin/** -> ORG_ADMIN (SecurityConfig), not by anything here.
@Service
public class OrganizationProfileService {

    private final OrganizationRepository organizationRepository;

    public OrganizationProfileService(OrganizationRepository organizationRepository) {
        this.organizationRepository = organizationRepository;
    }

    public OrganizationProfile getOwnProfile() {
        return getOwnOrganization().getProfile();
    }

    @Transactional
    public OrganizationProfile updateOwnProfile(String description, String contactEmail, String contactPhone,
                                                 String address, String businessHours, String websiteUrl,
                                                 String facebookUrl, String instagramUrl) {
        Organization organization = getOwnOrganization();
        OrganizationProfile updated = new OrganizationProfile(
                blankToNull(description), blankToNull(contactEmail), blankToNull(contactPhone),
                blankToNull(address), blankToNull(businessHours), blankToNull(websiteUrl),
                blankToNull(facebookUrl), blankToNull(instagramUrl));
        organization.setProfile(updated);
        organizationRepository.save(organization);
        return updated;
    }

    private Organization getOwnOrganization() {
        String schemaName = TenantContext.getCurrentTenant();
        return organizationRepository.findBySchemaName(schemaName)
                .orElseThrow(() -> new IllegalStateException("Unknown organization for current tenant"));
    }

    private static String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value;
    }
}
