import { apiClient, ApiError } from "./client";
import { tenantAuthHeaders } from "./auth";

// The tenant app's own view of AUDIT_LOG_EXPORTED, backing
// TenantAuditController — this organization's own ORG_ADMIN looking at
// their own audit_log from inside /app, as opposed to shared/api/platform.ts's
// PlatformAuditEntry/listOrganizationAudit(), which is a platform operator
// looking in at an arbitrary org from the Platform Console.
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

export interface TenantAuditPage {
  items: TenantAuditEntry[];
  page: number;
  size: number;
  totalItems: number;
  hasMore: boolean;
}

export interface ListTenantAuditParams {
  page?: number;
  size?: number;
  // Calendar dates ("YYYY-MM-DD"), not instants — matches
  // TenantAuditController's own from/to (whole-day, inclusive of `to`).
  from?: string;
  to?: string;
}

export async function listTenantAudit(params: ListTenantAuditParams = {}): Promise<TenantAuditPage> {
  const search = new URLSearchParams();
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.size !== undefined) search.set("size", String(params.size));
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  return apiClient.get<TenantAuditPage>(`/api/v1/admin/audit?${search.toString()}`, {
    headers: tenantAuthHeaders(),
  });
}

// Same download-via-raw-fetch approach as shared/api/platform.ts's own
// downloadCsv() — apiClient.get() always parses JSON, which a CSV response
// isn't, so this bypasses it: raw fetch, read the filename off
// Content-Disposition, trigger a synthetic <a download> click.
export interface ExportTenantAuditParams {
  from?: string;
  to?: string;
}

export async function exportTenantAudit(params: ExportTenantAuditParams = {}): Promise<void> {
  const search = new URLSearchParams();
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  const res = await fetch(`/api/v1/admin/audit/export?${search.toString()}`, { headers: tenantAuthHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? res.statusText, res.status);
  }
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const filename = match?.[1] ?? "audit-trail.csv";
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
