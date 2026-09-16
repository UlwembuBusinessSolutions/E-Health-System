package co.ehealth.platform.core.tenant;

import java.util.Arrays;
import java.util.stream.Collectors;

// Cross-tenant patient migration's MPI-collision fix — OrganizationProvisioningService's
// own call site at provisioning time is the only caller. Derives a short,
// human-recognisable code from the slug already being provisioned rather
// than a random string, e.g. "demo-clinic" -> "DC" — matches the
// DC-0000038-style example this feature was specced against. Static, not a
// @Service: it's a pure function of (slug, what codes already exist), same
// shape as SouthAfricanIdNumber.parse() elsewhere in this codebase.
public final class TenantCodeGenerator {

    private TenantCodeGenerator() {
    }

    public static String generate(String slug, OrganizationRepository organizationRepository) {
        String base = Arrays.stream(slug.split("[-_]"))
                .filter(part -> !part.isBlank())
                .map(part -> part.substring(0, 1).toUpperCase())
                .collect(Collectors.joining());

        // Collision fallback — SLUG_PATTERN guarantees every slug is unique
        // (OrganizationProvisioningService's own existsBySlug() check), but
        // two different slugs can still share the same first-letter
        // initials ("river-clinic" and "riverside-clinic" both give "RC").
        // Appending a number keeps every code unique without ever
        // re-deriving an already-issued one.
        String candidate = base;
        int suffix = 2;
        while (organizationRepository.existsByTenantCode(candidate)) {
            candidate = base + suffix;
            suffix++;
        }
        return candidate;
    }
}
