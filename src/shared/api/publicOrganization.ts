import { apiClient } from "./client";

// Backs PublicOrganizationController — the one organization surface
// reachable with no session at all. Used by tenant-site/TenantHomePage.tsx,
// a visitor's first stop before they've signed in or registered, so this
// deliberately never sends an Authorization/X-Patient-Key header, only
// X-Tenant-ID (same "TenantFilter resolves the schema independent of any
// auth header" precedent shared/api/auth.ts's password-reset calls rely
// on).
export interface PublicOrganization {
  displayName: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  shortName: string | null;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  businessHours: string | null;
  websiteUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  // Whether this org's Microsoft SSO is fully configured and switched on
  // — StaffLoginLayout/LoginScreen gate the "Sign in with Microsoft"
  // button on exactly this, never the raw settings toggle (which can be
  // on before the rest of the setup is finished).
  microsoftSsoEnabled: boolean;
}

export async function getPublicOrganization(tenantSlug: string): Promise<PublicOrganization> {
  return apiClient.get<PublicOrganization>("/api/v1/public/organization", {
    headers: { "X-Tenant-ID": tenantSlug },
  });
}
