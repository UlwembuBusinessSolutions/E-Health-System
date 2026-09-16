package co.ehealth.platform.core.tenant;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

// The one organization surface reachable with no session at all — a
// tenant's public landing page (patient-portal/TenantHomePage.tsx) needs
// name/branding/contact info before a visitor has ever signed in, unlike
// OrganizationBrandingController.getOrganization() which requires staff
// auth. Resolves via TenantContext alone, same as every other
// tenant-scoped-but-unauthenticated endpoint (AuthController's own
// password-reset pair is the existing precedent — TenantFilter resolves
// the schema from X-Tenant-ID independent of any Authorization header).
// Deliberately a narrower field set than OrganizationSelfResponse: no
// status/sector — nothing here should hint at operational details a
// signed-out visitor has no business seeing.
@RestController
public class PublicOrganizationController {

    private final OrganizationBrandingService brandingService;

    public PublicOrganizationController(OrganizationBrandingService brandingService) {
        this.brandingService = brandingService;
    }

    @GetMapping("/api/v1/public/organization")
    public ResponseEntity<PublicOrganizationResponse> getPublicOrganization() {
        Organization organization = brandingService.getOwnOrganization();
        OrganizationBranding branding = organization.getBranding();
        OrganizationProfile profile = organization.getProfile();
        return ResponseEntity.ok(new PublicOrganizationResponse(
                organization.getDisplayName(), organization.getSlug(), branding.logoUrl(), branding.primaryColor(),
                branding.shortName(), profile.description(), profile.contactEmail(), profile.contactPhone(),
                profile.address(), profile.businessHours(), profile.websiteUrl(), profile.facebookUrl(),
                profile.instagramUrl()));
    }

    public record PublicOrganizationResponse(String displayName, String slug, String logoUrl, String primaryColor,
                                              String shortName, String description, String contactEmail,
                                              String contactPhone, String address, String businessHours,
                                              String websiteUrl, String facebookUrl, String instagramUrl) {
    }
}
