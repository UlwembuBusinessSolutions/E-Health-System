import type { Gender } from "./types";
import { apiClient } from "./client";

// Real backend calls — api/'s /platform/** endpoints (api-reference.html,
// Platform organizations module). No more MOCK_ORGANIZATIONS/delay(): this
// module was the first one wired up for real, to test the actual
// provision-org-and-assign-admins process end to end through the UI
// instead of curl.

const PLATFORM_TOKEN_KEY = "ulwembu.platformToken";

// sessionStorage, not localStorage — clears when the tab closes rather
// than sitting around indefinitely. PlatformAuthContext's own operator
// state already doesn't survive a refresh either (plain React state), so
// this doesn't change that; it just gives the actual API calls something
// to send as X-Platform-Key between login and logout within one session.
function getPlatformToken(): string | null {
  return sessionStorage.getItem(PLATFORM_TOKEN_KEY);
}

function setPlatformToken(token: string): void {
  sessionStorage.setItem(PLATFORM_TOKEN_KEY, token);
}

export function clearPlatformToken(): void {
  sessionStorage.removeItem(PLATFORM_TOKEN_KEY);
}

function authHeaders(): HeadersInit {
  const token = getPlatformToken();
  return token ? { "X-Platform-Key": token } : {};
}

export type OrganizationStatus = "ACTIVE" | "SUSPENDED";

// Matches OrganizationSector field-for-field (SADM-US-002).
export type OrganizationSector = "PUBLIC" | "PRIVATE" | "OCCUPATIONAL";

export interface OrganizationSummary {
  id: string;
  slug: string;
  displayName: string;
  status: OrganizationStatus;
  sector: OrganizationSector;
  logoUrl: string | null;
  createdAt: string;
  enabledModuleCount: number;
  totalModuleCount: number;
}

// One admin's details — matches PlatformController.AdminRequest field-for-field.
export interface AdminInput {
  firstName: string;
  lastName: string;
  employeeNumber: string;
  email: string;
  contactNumber: string;
  gender: Gender;
}

export interface ProvisionedAdmin {
  userId: string;
  email: string;
  temporaryPassword: string;
}

export interface ProvisionOrganizationPayload {
  slug: string;
  displayName: string;
  sector: OrganizationSector;
  admins: AdminInput[];
}

export interface ProvisionedOrganization {
  organizationId: string;
  slug: string;
  schemaName: string;
  admins: ProvisionedAdmin[];
}

export interface AddOrganizationAdminsPayload {
  admins: AdminInput[];
}

export interface PlatformOperator {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface PlatformLoginPayload {
  email: string;
  password: string;
}

interface PlatformLoginResponse {
  accessToken: string;
  expiresAt: string;
  operator: PlatformOperator;
}

export async function loginPlatformOperator(payload: PlatformLoginPayload): Promise<PlatformOperator> {
  const response = await apiClient.post<PlatformLoginResponse>("/platform/auth/login", payload);
  setPlatformToken(response.accessToken);
  return response.operator;
}

export interface ListOrganizationsParams {
  q?: string;
  status?: OrganizationStatus;
  sort?: "newest" | "oldest";
}

export async function listOrganizations(params: ListOrganizationsParams = {}): Promise<OrganizationSummary[]> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.sort) search.set("sort", params.sort);
  const queryString = search.toString();
  const response = await apiClient.get<{ items: OrganizationSummary[] }>(
    `/platform/organizations${queryString ? `?${queryString}` : ""}`,
    { headers: authHeaders() },
  );
  return response.items;
}

export async function provisionOrganization(
  payload: ProvisionOrganizationPayload,
): Promise<ProvisionedOrganization> {
  return apiClient.post<ProvisionedOrganization>("/platform/organizations", payload, { headers: authHeaders() });
}

export async function getOrganization(id: string): Promise<OrganizationSummary> {
  return apiClient.get<OrganizationSummary>(`/platform/organizations/${id}`, { headers: authHeaders() });
}

export interface UpdateOrganizationPayload {
  displayName: string;
  sector: OrganizationSector;
}

// Slug is deliberately not part of this payload — it's permanent, see the
// backend's own why-note (Organization.rename()) on why: it's what the
// tenant's schema name and every login URL are built from.
export async function updateOrganization(
  id: string,
  payload: UpdateOrganizationPayload,
): Promise<OrganizationSummary> {
  return apiClient.patch<OrganizationSummary>(`/platform/organizations/${id}`, payload, { headers: authHeaders() });
}

// The fix for "client's only admin is locked out / left / wants a second
// admin added by us" — see OrganizationProvisioningService.addAdmins()
// (api-reference.html, Platform organizations module).
export async function addOrganizationAdmins(
  organizationId: string,
  payload: AddOrganizationAdminsPayload,
): Promise<ProvisionedOrganization> {
  return apiClient.post<ProvisionedOrganization>(
    `/platform/organizations/${organizationId}/admins`,
    payload,
    { headers: authHeaders() },
  );
}

// No real endpoint for this — provisioning was never given a dedicated
// "check slug availability" route, only the create call itself, which
// 409s on a real collision. Always true so the on-blur check never blocks
// submission; ProvisionOrganizationScreen's mutation error handling
// already surfaces the real 409 message if the create call itself fails.
export async function checkSlugAvailable(_slug: string): Promise<boolean> {
  return true;
}

export async function suspendOrganization(id: string): Promise<void> {
  await apiClient.post<void>(`/platform/organizations/${id}/suspend`, undefined, { headers: authHeaders() });
}

export async function reactivateOrganization(id: string): Promise<void> {
  await apiClient.post<void>(`/platform/organizations/${id}/reactivate`, undefined, { headers: authHeaders() });
}

// A follow-up call, not part of provisioning — an org has no id for a file
// to attach to until the create call above returns. FormData, same as
// uploadStaffPhoto: apiClient.post skips the JSON Content-Type for a
// FormData body so the browser can set the multipart boundary itself.
export async function uploadOrganizationLogo(organizationId: string, file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const response = await apiClient.post<{ logoUrl: string }>(
    `/platform/organizations/${organizationId}/logo`,
    form,
    { headers: authHeaders() },
  );
  return response.logoUrl;
}

// SADM-US-010. Matches ModuleCode field-for-field — all 20 codes always
// come back, not just the ones this org has an opinion about (see
// OrganizationProvisioningService.listModuleEntitlements()'s own why-note).
export type ModulePhase = "FOUNDATION" | "MVP0" | "PHASE_2" | "PHASE_3" | "PHASE_4";

export interface ModuleEntitlement {
  code: string;
  displayName: string;
  phase: ModulePhase;
  foundation: boolean;
  enabled: boolean;
}

export async function listOrganizationModules(organizationId: string): Promise<ModuleEntitlement[]> {
  const response = await apiClient.get<{ items: ModuleEntitlement[] }>(
    `/platform/organizations/${organizationId}/modules`,
    { headers: authHeaders() },
  );
  return response.items;
}

// Foundation modules (SADM/AUDT/IAM) 409 if targeted — the caller is
// expected to never offer the toggle for one in the first place, same as
// the backend never expecting a request for one to be well-formed.
export async function toggleOrganizationModule(
  organizationId: string,
  moduleCode: string,
  enabled: boolean,
): Promise<void> {
  await apiClient.post<void>(
    `/platform/organizations/${organizationId}/modules/${moduleCode}`,
    { enabled },
    { headers: authHeaders() },
  );
}

// SADM-US-006. Matches PlatformController.FacilityResponse field-for-field.
export type FacilityType = "CLINIC" | "HOSPITAL" | "STORE";

export interface Facility {
  id: string;
  name: string;
  code: string;
  type: FacilityType;
  address: string | null;
  phone: string | null;
  operatingHours: string | null;
  active: boolean;
}

export interface AddClinicPayload {
  name: string;
  code: string;
  type: FacilityType;
  address?: string;
  phone?: string;
  operatingHours?: string;
}

export async function listOrganizationFacilities(organizationId: string): Promise<Facility[]> {
  const response = await apiClient.get<{ items: Facility[] }>(
    `/platform/organizations/${organizationId}/facilities`,
    { headers: authHeaders() },
  );
  return response.items;
}

// A platform operator adding a clinic to a tenant it doesn't have a
// session for — see OrganizationProvisioningService.addClinic()'s own
// why-note on why this is a separate route from the tenant-side
// /api/v1/facilities an ORG_ADMIN uses for the same underlying entity.
export async function addOrganizationFacility(
  organizationId: string,
  payload: AddClinicPayload,
): Promise<Facility> {
  return apiClient.post<Facility>(
    `/platform/organizations/${organizationId}/facilities`,
    payload,
    { headers: authHeaders() },
  );
}

// Matches identity.UserStatus field-for-field.
export type StaffStatus = "ACTIVE" | "LOCKED" | "DISABLED";

// One admin already assigned to an organization — matches
// StaffService.AdminSummary field-for-field (PlatformController.listAdmins()
// returns these directly, no separate DTO on the backend).
export interface OrgAdmin {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: StaffStatus;
}

export async function listOrganizationAdmins(organizationId: string): Promise<OrgAdmin[]> {
  const response = await apiClient.get<{ items: OrgAdmin[] }>(`/platform/organizations/${organizationId}/admins`, {
    headers: authHeaders(),
  });
  return response.items;
}

// Revokes ORG_ADMIN only — the account itself keeps existing, same as the
// backend's own removeAdmin()/revokeOrgAdminRole(). Refuses (409) an org's
// last remaining admin.
export async function removeOrganizationAdmin(organizationId: string, userId: string): Promise<void> {
  await apiClient.delete<void>(`/platform/organizations/${organizationId}/admins/${userId}`, {
    headers: authHeaders(),
  });
}

// The platform-side fix for "an admin is locked out and there's nobody left
// inside the org who could reset it for them" — OrganizationProvisioningService.resetAdminPassword()'s
// own why-note. temporaryPassword returned exactly once.
export interface ResetPasswordResponse {
  temporaryPassword: string;
}

export async function resetOrganizationAdminPassword(
  organizationId: string,
  userId: string,
): Promise<ResetPasswordResponse> {
  return apiClient.post<ResetPasswordResponse>(
    `/platform/organizations/${organizationId}/admins/${userId}/reset-password`,
    undefined,
    { headers: authHeaders() },
  );
}

// Refuses (409) to disable an organization's last remaining admin — same
// guard as removeOrganizationAdmin(), enforced inside StaffService.setEnabled()
// itself.
export async function setOrganizationAdminEnabled(
  organizationId: string,
  userId: string,
  enabled: boolean,
): Promise<void> {
  await apiClient.post<void>(
    `/platform/organizations/${organizationId}/admins/${userId}/${enabled ? "enable" : "disable"}`,
    undefined,
    { headers: authHeaders() },
  );
}

// Matches PlatformOperatorStatus field-for-field.
export type PlatformOperatorStatus = "ACTIVE" | "LOCKED" | "DISABLED";

// The full roster — matches PlatformOperatorService.OperatorSummary
// field-for-field. Never a password or password hash; the platform login
// endpoint's own response (the `PlatformOperator` interface above) is a
// separate, narrower shape for "who am I signed in as," not this list.
export interface PlatformOperatorSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: PlatformOperatorStatus;
  lastLoginAt: string | null;
  createdAt: string;
}

export async function listPlatformOperators(): Promise<PlatformOperatorSummary[]> {
  const response = await apiClient.get<{ items: PlatformOperatorSummary[] }>("/platform/operators", {
    headers: authHeaders(),
  });
  return response.items;
}

export interface CreatePlatformOperatorPayload {
  firstName: string;
  lastName: string;
  email: string;
}

// temporaryPassword is returned exactly once, same discipline as
// ProvisionedAdmin above — the caller's success state is the only place
// it's ever shown.
export interface CreatedPlatformOperator {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  temporaryPassword: string;
}

export async function createPlatformOperator(
  payload: CreatePlatformOperatorPayload,
): Promise<CreatedPlatformOperator> {
  return apiClient.post<CreatedPlatformOperator>("/platform/operators", payload, { headers: authHeaders() });
}

// Admin-triggered — platform operators have no self-service reset flow at
// all (unlike tenant staff's /api/v1/auth/password-reset/**), so "another
// operator generates and hands over a new one" is the only recovery lever.
// temporaryPassword returned exactly once.
export async function resetOperatorPassword(operatorId: string): Promise<ResetPasswordResponse> {
  return apiClient.post<ResetPasswordResponse>(`/platform/operators/${operatorId}/reset-password`, undefined, {
    headers: authHeaders(),
  });
}

// Refuses (409) to disable the last active platform operator —
// PlatformOperatorService.setEnabled()'s own guard.
export async function setOperatorEnabled(operatorId: string, enabled: boolean): Promise<void> {
  await apiClient.post<void>(`/platform/operators/${operatorId}/${enabled ? "enable" : "disable"}`, undefined, {
    headers: authHeaders(),
  });
}

// AUDT-US-005/006. Every platform-level write — provisioning, suspend/
// reactivate, module toggles, detail edits, operator creation — lands one
// of these rows (PlatformAuditService's own why-note on what "platform-level"
// means here vs. an organization's own tenant-schema trail below).
export interface PlatformAuditEntry {
  id: string;
  action: string;
  detail: string | null;
  createdAt: string;
  operatorName: string;
  operatorEmail: string;
  organizationId: string | null;
  organizationName: string | null;
  ipAddress: string | null;
  deviceSignature: string | null;
}

export interface ListPlatformAuditParams {
  action?: string;
  organizationId?: string;
  from?: string;
  to?: string;
}

export async function listPlatformAudit(params: ListPlatformAuditParams = {}): Promise<PlatformAuditEntry[]> {
  const search = new URLSearchParams();
  if (params.action) search.set("action", params.action);
  if (params.organizationId) search.set("organizationId", params.organizationId);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  const queryString = search.toString();
  const response = await apiClient.get<{ items: PlatformAuditEntry[] }>(
    `/platform/audit${queryString ? `?${queryString}` : ""}`,
    { headers: authHeaders() },
  );
  return response.items;
}

// One organization's own trail (its tenant-schema audit_log), viewed by a
// platform operator — OrganizationProvisioningService.listTenantAuditLog()'s
// own why-note on why this stays a separate, filter-free read from the one
// above.
// beforeValue/afterValue are raw JSON text, straight from AuditLog's own
// jsonb columns — null for every action that doesn't capture a state
// snapshot, which is still most of them (only LOGIN populates these today,
// see AuthService.serializeLoginState()'s own why-note).
export interface TenantAuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  actorName: string;
  beforeValue: string | null;
  afterValue: string | null;
  ipAddress: string | null;
  deviceSignature: string | null;
}

export async function listOrganizationAudit(organizationId: string): Promise<TenantAuditEntry[]> {
  const response = await apiClient.get<{ items: TenantAuditEntry[] }>(
    `/platform/organizations/${organizationId}/audit`,
    { headers: authHeaders() },
  );
  return response.items;
}
