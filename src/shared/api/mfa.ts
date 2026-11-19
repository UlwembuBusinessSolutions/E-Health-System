import { apiClient } from "./client";
import { tenantAuthHeaders, getTenantSlug } from "./auth";
import type { LoginResponse } from "./auth";

export interface MfaEnrolmentSecret {
  secret: string;
  otpauthUri: string;
}

export interface MfaStatus {
  enrolled: boolean;
  required: boolean;
  canDisable: boolean;
  recoveryCodesRemaining: number;
}

export interface RoleMfaPolicy {
  roleId: string;
  roleName: string;
  policy: "OPTIONAL" | "MANDATORY";
}

function challengeHeaders(): HeadersInit {
  const tenantSlug = getTenantSlug();
  return tenantSlug ? { "X-Tenant-ID": tenantSlug } : {};
}

export async function verifyMfaLogin(
  challengeToken: string,
  code?: string,
  recoveryCode?: string,
): Promise<LoginResponse> {
  return apiClient.post<LoginResponse>(
    "/api/v1/auth/mfa/verify",
    { challengeToken, code: code || null, recoveryCode: recoveryCode || null },
    { headers: challengeHeaders() },
  );
}

export async function startMfaChallengeEnrolment(challengeToken: string): Promise<MfaEnrolmentSecret> {
  return apiClient.post<MfaEnrolmentSecret>(
    "/api/v1/auth/mfa/enrol/start",
    { challengeToken },
    { headers: challengeHeaders() },
  );
}

export async function confirmMfaChallengeEnrolment(
  challengeToken: string,
  code: string,
): Promise<LoginResponse> {
  return apiClient.post<LoginResponse>(
    "/api/v1/auth/mfa/enrol/confirm",
    { challengeToken, code },
    { headers: challengeHeaders() },
  );
}

export async function getMfaStatus(): Promise<MfaStatus> {
  return apiClient.get<MfaStatus>("/api/v1/auth/mfa/status", { headers: tenantAuthHeaders() });
}

export async function startMfaSetup(): Promise<MfaEnrolmentSecret> {
  return apiClient.post<MfaEnrolmentSecret>("/api/v1/auth/mfa/setup", undefined, {
    headers: tenantAuthHeaders(),
  });
}

export async function confirmMfaSetup(code: string): Promise<string[]> {
  const response = await apiClient.post<{ recoveryCodes: string[] }>(
    "/api/v1/auth/mfa/setup/confirm",
    { code },
    { headers: tenantAuthHeaders() },
  );
  return response.recoveryCodes;
}

export async function regenerateMfaRecoveryCodes(code: string): Promise<string[]> {
  const response = await apiClient.post<{ recoveryCodes: string[] }>(
    "/api/v1/auth/mfa/recovery-codes/regenerate",
    { code },
    { headers: tenantAuthHeaders() },
  );
  return response.recoveryCodes;
}

export async function disableMfa(password: string, code: string): Promise<void> {
  await apiClient.post<void>("/api/v1/auth/mfa/disable", { password, code }, {
    headers: tenantAuthHeaders(),
  });
}

export async function listRoleMfaPolicies(): Promise<RoleMfaPolicy[]> {
  const response = await apiClient.get<{ items: RoleMfaPolicy[] }>("/api/v1/admin/mfa/policies", {
    headers: tenantAuthHeaders(),
  });
  return response.items;
}

export async function setRoleMfaPolicy(
  roleId: string,
  policy: RoleMfaPolicy["policy"],
): Promise<RoleMfaPolicy> {
  return apiClient.put<RoleMfaPolicy>(
    `/api/v1/admin/mfa/policies/${roleId}`,
    { policy },
    { headers: tenantAuthHeaders() },
  );
}

export async function resetStaffMfa(staffId: string): Promise<void> {
  await apiClient.post<void>(`/api/v1/admin/staff/${staffId}/mfa/reset`, undefined, {
    headers: tenantAuthHeaders(),
  });
}
