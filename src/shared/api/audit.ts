// import { apiClient } from "./client";
// import { tenantAuthHeaders } from "./auth";

// export type AuditModule = "SADM" | "IAM" | "PREG" | "RECQ" | "PHRM";

// export interface AuditEntry {
//   id: string;
//   action: string;
//   entityType: string;
//   entityId: string;
//   createdAt: string;
//   userId: string | null;
//   userName: string;
//   facilityId: string | null;
//   beforeValue: string | null;
//   afterValue: string | null;
//   ipAddress: string | null;
//   deviceSignature: string | null;
// }

// export interface ListAuditParams {
//   from?: string; // yyyy-MM-dd
//   to?: string; // yyyy-MM-dd
//   userId?: string;
//   action?: string;
//   module?: AuditModule;
//   entityId?: string;
// }

// export async function listAuditLog(params: ListAuditParams = {}): Promise<AuditEntry[]> {
//   const search = new URLSearchParams();
//   if (params.from) search.set("from", params.from);
//   if (params.to) search.set("to", params.to);
//   if (params.userId) search.set("userId", params.userId);
//   if (params.action) search.set("action", params.action);
//   if (params.module) search.set("module", params.module);
//   if (params.entityId) search.set("entityId", params.entityId);
//   const queryString = search.toString();
//   const response = await apiClient.get<{ items: AuditEntry[] }>(`/api/v1/audit${queryString ? `?${queryString}` : ""}`, { headers: tenantAuthHeaders() },);
//   return response.items;
// }


import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export type AuditModule = "SADM" | "IAM" | "PREG" | "RECQ" | "PHRM";

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  userId: string | null;
  userName: string;
  facilityId: string | null;
  privileged: boolean;
  beforeValue: string | null;
  afterValue: string | null;
  ipAddress: string | null;
  deviceSignature: string | null;
}

export interface ListAuditParams {
  from?: string; // yyyy-MM-dd
  to?: string; // yyyy-MM-dd
  userId?: string;
  action?: string;
  module?: AuditModule;
  entityId?: string;
  privileged?: boolean;
}

export async function listAuditLog(params: ListAuditParams = {}): Promise<AuditEntry[]> {
  const search = new URLSearchParams();
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  if (params.userId) search.set("userId", params.userId);
  if (params.action) search.set("action", params.action);
  if (params.module) search.set("module", params.module);
  if (params.entityId) search.set("entityId", params.entityId);
  if (params.privileged !== undefined) search.set("privileged", String(params.privileged));
  const queryString = search.toString();
  const response = await apiClient.get<{ items: AuditEntry[] }>(
    `/api/v1/audit${queryString ? `?${queryString}` : ""}`,
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}