package co.ehealth.platform.core.tenant;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

// Backs the control.organizations.profile JSONB column — org-wide contact/
// location info (as opposed to Facility.address/phone/operatingHours,
// which is per-facility and already exists) meant to eventually back a
// public tenant-facing site instead of anything being hardcoded there.
// businessHours is deliberately free text, matching Facility.operatingHours'
// own shape ("Mon-Fri 07:00-16:00") rather than inventing a structured
// weekly schedule this codebase has no other precedent for.
//
// @JsonIgnoreProperties(ignoreUnknown = true) as a defensive default —
// OrganizationMailSettings didn't have this and a bean-style getter
// (isConfigured()) got silently serialized into stored JSON by Hibernate's
// JacksonJsonFormatMapper, then rejected on every subsequent read. Applied
// here up front rather than after the same bug repeats.
@JsonIgnoreProperties(ignoreUnknown = true)
public record OrganizationProfile(String description, String contactEmail, String contactPhone, String address,
                                   String businessHours, String websiteUrl, String facebookUrl,
                                   String instagramUrl) {

    public static OrganizationProfile empty() {
        return new OrganizationProfile(null, null, null, null, null, null, null, null);
    }
}
