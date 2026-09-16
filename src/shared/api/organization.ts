import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

// Real from the start — no mock era for either of these. Back
// OrganizationBrandingController (api-reference.html, Organization
// branding module). getOrganizationSelf() is open to any authenticated
// staff member — name, status, sector and branding are all things everyone
// in the org is meant to see, same reasoning GET /api/v1/facilities is
// open to any authenticated user while only writes are admin-gated.
// uploadOrganizationLogo() is ORG_ADMIN-only server-side. The org itself is
// always the caller's own tenant (resolved from X-Tenant-ID + token), never
// a target passed by the client — this is the tenant-side counterpart to
// platform.ts's OrganizationSummary, which is the same underlying record
// seen by a platform operator instead.
export type OrganizationStatus = "ACTIVE" | "SUSPENDED";
export type OrganizationSector = "PUBLIC" | "PRIVATE" | "OCCUPATIONAL";

export interface OrganizationSelf {
  displayName: string;
  slug: string;
  status: OrganizationStatus;
  sector: OrganizationSector;
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

export async function getOrganizationSelf(): Promise<OrganizationSelf> {
  return apiClient.get<OrganizationSelf>("/api/v1/organization", { headers: tenantAuthHeaders() });
}

// Backs OrganizationProfileController — ORG_ADMIN-only write for the
// "Contact info" section of the tenant app's Settings tab. The read half
// rides along on getOrganizationSelf() above (OrganizationSelf's own
// description/contactEmail/... fields) rather than a separate GET, same
// "open to any staff, only writes are admin-gated" split branding uses.
export interface UpdateOrganizationProfilePayload {
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  businessHours?: string;
  websiteUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
}

export async function updateOrganizationProfile(
  payload: UpdateOrganizationProfilePayload,
): Promise<void> {
  await apiClient.patch<void>("/api/v1/admin/organization/profile", payload, { headers: tenantAuthHeaders() });
}

// SADM-US-010's self-service half — the same 20-module picture a platform
// operator sees for an arbitrary org (shared/api/platform.ts's
// ModuleEntitlement), just always the caller's own.
export type ModulePhase = "FOUNDATION" | "MVP0" | "PHASE_2" | "PHASE_3" | "PHASE_4";

export interface ModuleEntitlement {
  code: string;
  displayName: string;
  phase: ModulePhase;
  foundation: boolean;
  enabled: boolean;
}

export async function getOrganizationModules(): Promise<ModuleEntitlement[]> {
  const response = await apiClient.get<{ items: ModuleEntitlement[] }>("/api/v1/organization/modules", {
    headers: tenantAuthHeaders(),
  });
  return response.items;
}

// The write half — ORG_ADMIN self-service toggling, same underlying rows
// a platform operator's own toggleOrganizationModule() (shared/api/platform.ts)
// writes, just always the caller's own org. Foundation modules 409 if
// targeted, same reasoning as the platform-operator equivalent.
export async function toggleOrganizationModule(moduleCode: string, enabled: boolean): Promise<void> {
  await apiClient.post<void>(
    `/api/v1/admin/organization/modules/${moduleCode}`,
    { enabled },
    { headers: tenantAuthHeaders() },
  );
}

export interface LogoUploadResponse {
  logoUrl: string;
}

export async function uploadOrganizationLogo(file: File): Promise<LogoUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  return apiClient.post<LogoUploadResponse>("/api/v1/admin/organization/logo", form, {
    headers: tenantAuthHeaders(),
  });
}

// Backs OrganizationMailSettingsController — ORG_ADMIN-only, the "Email"
// section of the tenant app's Settings tab. Same SMTP credentials every
// outbound email (staff/admin account created, password reset) goes
// through once configured — see core/notification/EmailService.java.
// password is never returned by the GET: passwordSet is the only signal
// the form gets, so it renders the password field blank and only sends a
// new value when the admin actually types one (see updateOrganizationMailSettings).
export interface OrganizationMailSettings {
  host: string | null;
  port: number | null;
  username: string | null;
  passwordSet: boolean;
  fromAddress: string | null;
}

export interface UpdateOrganizationMailSettingsPayload {
  host: string;
  port: number;
  username: string;
  // Omit (or send blank) to keep the currently stored password — mirrors
  // OrganizationMailSettingsService.updateOwnMailSettings()'s "blank means
  // leave it alone" rule.
  password?: string;
  fromAddress: string;
}

export async function getOrganizationMailSettings(): Promise<OrganizationMailSettings> {
  return apiClient.get<OrganizationMailSettings>("/api/v1/admin/organization/mail-settings", {
    headers: tenantAuthHeaders(),
  });
}

export async function updateOrganizationMailSettings(
  payload: UpdateOrganizationMailSettingsPayload,
): Promise<OrganizationMailSettings> {
  return apiClient.patch<OrganizationMailSettings>("/api/v1/admin/organization/mail-settings", payload, {
    headers: tenantAuthHeaders(),
  });
}
