import type { Gender } from "./types";
import { apiClient } from "./client";

const PLATFORM_TOKEN_KEY = "ulwembu.platformToken";

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

export async function loginPlatformOperator(
  payload: PlatformLoginPayload,
): Promise<PlatformOperator> {
  const response = await apiClient.post<PlatformLoginResponse>(
    "/platform/auth/login",
    payload,
  );

  setPlatformToken(response.accessToken);

  return response.operator;
}

export interface ListOrganizationsParams {
  q?: string;
  status?: OrganizationStatus;
  sort?: "newest" | "oldest";
}

export async function listOrganizations(
  params: ListOrganizationsParams = {},
): Promise<OrganizationSummary[]> {
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
  return apiClient.post<ProvisionedOrganization>(
    "/platform/organizations",
    payload,
    { headers: authHeaders() },
  );
}

export async function getOrganization(
  id: string,
): Promise<OrganizationSummary> {
  return apiClient.get<OrganizationSummary>(
    `/platform/organizations/${id}`,
    { headers: authHeaders() },
  );
}

export interface UpdateOrganizationPayload {
  displayName: string;
  sector: OrganizationSector;
}

export async function updateOrganization(
  id: string,
  payload: UpdateOrganizationPayload,
): Promise<OrganizationSummary> {
  return apiClient.patch<OrganizationSummary>(
    `/platform/organizations/${id}`,
    payload,
    { headers: authHeaders() },
  );
}

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

export async function checkSlugAvailable(
  _slug: string,
): Promise<boolean> {
  return true;
}

export async function suspendOrganization(
  id: string,
): Promise<void> {
  await apiClient.post<void>(
    `/platform/organizations/${id}/suspend`,
    undefined,
    { headers: authHeaders() },
  );
}

export async function reactivateOrganization(
  id: string,
): Promise<void> {
  await apiClient.post<void>(
    `/platform/organizations/${id}/reactivate`,
    undefined,
    { headers: authHeaders() },
  );
}

export async function uploadOrganizationLogo(
  organizationId: string,
  file: File,
): Promise<string> {
  const form = new FormData();
  form.append("file", file);

  const response = await apiClient.post<{ logoUrl: string }>(
    `/platform/organizations/${organizationId}/logo`,
    form,
    { headers: authHeaders() },
  );

  return response.logoUrl;
}

export type ModulePhase =
  | "FOUNDATION"
  | "MVP0"
  | "PHASE_2"
  | "PHASE_3"
  | "PHASE_4";

export interface ModuleEntitlement {
  code: string;
  displayName: string;
  phase: ModulePhase;
  foundation: boolean;
  enabled: boolean;
}

export async function listOrganizationModules(
  organizationId: string,
): Promise<ModuleEntitlement[]> {
  const response = await apiClient.get<{
    items: ModuleEntitlement[];
  }>(
    `/platform/organizations/${organizationId}/modules`,
    { headers: authHeaders() },
  );

  return response.items;
}

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

export type FacilityType =
  | "CLINIC"
  | "HOSPITAL"
  | "STORE";

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

export async function listOrganizationFacilities(
  organizationId: string,
): Promise<Facility[]> {
  const response = await apiClient.get<{ items: Facility[] }>(
    `/platform/organizations/${organizationId}/facilities`,
    { headers: authHeaders() },
  );

  return response.items;
}

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

export type StaffStatus =
  | "ACTIVE"
  | "LOCKED"
  | "DISABLED";

export interface OrgAdmin {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: StaffStatus;
}

export async function listOrganizationAdmins(
  organizationId: string,
): Promise<OrgAdmin[]> {
  const response = await apiClient.get<{ items: OrgAdmin[] }>(
    `/platform/organizations/${organizationId}/admins`,
    { headers: authHeaders() },
  );

  return response.items;
}

export async function removeOrganizationAdmin(
  organizationId: string,
  userId: string,
): Promise<void> {
  await apiClient.delete<void>(
    `/platform/organizations/${organizationId}/admins/${userId}`,
    { headers: authHeaders() },
  );
}

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

export type PlatformOperatorStatus =
  | "ACTIVE"
  | "LOCKED"
  | "DISABLED";

export interface PlatformOperatorSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: PlatformOperatorStatus;
  lastLoginAt: string | null;
  createdAt: string;
}

export async function listPlatformOperators(): Promise<
  PlatformOperatorSummary[]
> {
  const response = await apiClient.get<{
    items: PlatformOperatorSummary[];
  }>(
    "/platform/operators",
    { headers: authHeaders() },
  );

  return response.items;
}

export interface CreatePlatformOperatorPayload {
  firstName: string;
  lastName: string;
  email: string;
}

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
  return apiClient.post<CreatedPlatformOperator>(
    "/platform/operators",
    payload,
    { headers: authHeaders() },
  );
}

export async function resetOperatorPassword(
  operatorId: string,
): Promise<ResetPasswordResponse> {
  return apiClient.post<ResetPasswordResponse>(
    `/platform/operators/${operatorId}/reset-password`,
    undefined,
    { headers: authHeaders() },
  );
}

export async function setOperatorEnabled(
  operatorId: string,
  enabled: boolean,
): Promise<void> {
  await apiClient.post<void>(
    `/platform/operators/${operatorId}/${enabled ? "enable" : "disable"}`,
    undefined,
    { headers: authHeaders() },
  );
}

export interface PlatformAuditEntry {
  id: string;
  action: string;
  detail: string | null;
  createdAt: string;
  operatorName: string;
  operatorEmail: string;
  organizationId: string | null;
  organizationName: string | null;
  privileged: boolean;
  ipAddress: string | null;
  deviceSignature: string | null;
}

export interface ListPlatformAuditParams {
  action?: string;
  organizationId?: string;
  from?: string;
  to?: string;
  privileged?: boolean;
}

export async function listPlatformAudit(
  params: ListPlatformAuditParams = {},
): Promise<PlatformAuditEntry[]> {
  const search = new URLSearchParams();

  if (params.action) {
    search.set("action", params.action);
  }

  if (params.organizationId) {
    search.set("organizationId", params.organizationId);
  }

  if (params.from) {
    search.set("from", params.from);
  }

  if (params.to) {
    search.set("to", params.to);
  }

  if (params.privileged !== undefined) {
    search.set("privileged", String(params.privileged));
  }

  const queryString = search.toString();

  const response = await apiClient.get<{
    items: PlatformAuditEntry[];
  }>(
    `/platform/audit${queryString ? `?${queryString}` : ""}`,
    { headers: authHeaders() },
  );

  return response.items;
}

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

export async function listOrganizationAudit(
  organizationId: string,
): Promise<TenantAuditEntry[]> {
  const response = await apiClient.get<{
    items: TenantAuditEntry[];
  }>(
    `/platform/organizations/${organizationId}/audit`,
    { headers: authHeaders() },
  );

  return response.items;
}
