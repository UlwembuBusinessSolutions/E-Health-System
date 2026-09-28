package co.ehealth.platform.core.tenant;

// Backs the control.organizations.branding JSONB column — a real column
// that existed with nothing behind it (no Java mapping, no writer, no
// endpoint) until OrganizationBrandingService. logoUrl is the first field
// actually populated by application code; primaryColor/shortName mirror
// what web/src/tenant/TenantContext.tsx already renders from a frontend
// mock, so this record's shape is deliberately ready for those too, not
// just designed around the one field with a real writer today.
public record OrganizationBranding(String logoUrl, String primaryColor, String shortName) {

    public static OrganizationBranding empty() {
        return new OrganizationBranding(null, null, null);
    }

    public OrganizationBranding withLogoUrl(String newLogoUrl) {
        return new OrganizationBranding(newLogoUrl, primaryColor, shortName);
    }
}
