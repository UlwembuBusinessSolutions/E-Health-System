import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export interface TenantAuditEntry {
  id: string;
  userId: string | null;
  facilityId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  beforeValue: string | null;
  afterValue: string | null;
  ipAddress: string | null;
  deviceSignature: string | null;
  createdAt: string;
}

export async function listTenantAudit(): Promise<TenantAuditEntry[]> {
  const response = await apiClient.get<{ items: TenantAuditEntry[] }>('/api/v1/admin/audit', {
    headers: tenantAuthHeaders(),
  });
  return response.items;
}
