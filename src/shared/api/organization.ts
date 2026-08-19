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
}

export async function getOrganizationSelf(): Promise<OrganizationSelf> {
  return apiClient.get<OrganizationSelf>("/api/v1/organization", { headers: tenantAuthHeaders() });
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
