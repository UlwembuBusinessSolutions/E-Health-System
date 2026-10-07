import { apiClient } from "./client";
import { tenantAuthHeaders, getTenantToken, replaceTenantToken } from "./auth";

export interface SessionStatus {
  serverTime: string;
  expiresAt: string;
  idleExpiresAt: string;
  idleTimeoutSeconds: number;
  warningSeconds: number;
}
export interface ContinuedSession extends SessionStatus { accessToken: string }

export function getSessionStatus() {
  return apiClient.get<SessionStatus>("/api/v1/auth/session", { headers: tenantAuthHeaders() });
}
export function recordSessionActivity() {
  return apiClient.post<SessionStatus>("/api/v1/auth/session/activity", undefined, { headers: tenantAuthHeaders() });
}
export async function continueSession() {
  const previousToken = getTenantToken();
  const result = await apiClient.post<ContinuedSession>("/api/v1/auth/session/continue", undefined, { headers: tenantAuthHeaders() });
  // A request finishing after logout must not restore credentials.
  if (getTenantToken() === previousToken && previousToken) replaceTenantToken(result.accessToken);
  return result;
}
export function endSession() {
  return apiClient.post<void>("/api/v1/auth/logout", undefined, { headers: tenantAuthHeaders() });
}
