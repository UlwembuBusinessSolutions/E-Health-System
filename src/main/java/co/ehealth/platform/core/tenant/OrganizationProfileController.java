package co.ehealth.platform.core.tenant;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

// ORG_ADMIN-only write surface for the tenant's own contact/location
// profile — the "Contact info" section of the tenant app's Settings tab.
// The read half lives on GET /api/v1/organization instead of here
// (OrganizationBrandingController.getOrganization(), same open-to-any-staff
// reasoning as branding: none of this is sensitive, unlike SMTP
// credentials). Covered by SecurityConfig's existing /api/v1/admin/** ->
// ORG_ADMIN matcher.
@RestController
public class OrganizationProfileController {

    private final OrganizationProfileService profileService;

    public OrganizationProfileController(OrganizationProfileService profileService) {
        this.profileService = profileService;
    }

    @PatchMapping("/api/v1/admin/organization/profile")
    public ResponseEntity<OrganizationProfile> updateProfile(@RequestBody ProfileRequest request) {
        OrganizationProfile updated = profileService.updateOwnProfile(
                request.description(), request.contactEmail(), request.contactPhone(), request.address(),
                request.businessHours(), request.websiteUrl(), request.facebookUrl(), request.instagramUrl());
        return ResponseEntity.ok(updated);
    }

    public record ProfileRequest(String description, String contactEmail, String contactPhone, String address,
                                  String businessHours, String websiteUrl, String facebookUrl,
                                  String instagramUrl) {
    }
}
