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
}

export async function getPublicOrganization(tenantSlug: string): Promise<PublicOrganization> {
  return apiClient.get<PublicOrganization>("/api/v1/public/organization", {
    headers: { "X-Tenant-ID": tenantSlug },
  });
}
