import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export type AuditModule =
  | "SADM"
  | "IAM"
  | "PREG"
  | "RECQ"
  | "PHRM"
  | "AUDT";

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

  auditSequence: number | null;
  previousHash: string | null;
  integrityHash: string | null;

  beforeValue: string | null;
  afterValue: string | null;

  ipAddress: string | null;
  deviceSignature: string | null;
}

export interface ListAuditParams {
  from?: string;
  to?: string;
  userId?: string;
  action?: string;
  module?: AuditModule;
  entityId?: string;
  privileged?: boolean;
}

function buildAuditQuery(
  params: ListAuditParams = {},
): string {
  const search = new URLSearchParams();

  if (params.from) {
    search.set("from", params.from);
  }

  if (params.to) {
    search.set("to", params.to);
  }

  if (params.userId) {
    search.set("userId", params.userId);
  }

  if (params.action) {
    search.set("action", params.action);
  }

  if (params.module) {
    search.set("module", params.module);
  }

  if (params.entityId) {
    search.set("entityId", params.entityId);
  }

  if (params.privileged !== undefined) {
    search.set(
      "privileged",
      String(params.privileged),
    );
  }

  return search.toString();
}

export async function listAuditLog(
  params: ListAuditParams = {},
): Promise<AuditEntry[]> {
  const queryString = buildAuditQuery(params);

  const response = await apiClient.get<{
    items: AuditEntry[];
  }>(
    `/api/v1/audit${
      queryString
        ? `?${queryString}`
        : ""
    }`,
    {
      headers: tenantAuthHeaders(),
    },
  );

  return response.items;
}

/**
 * Export the currently filtered tenant audit trail
 * as CSV.
 */
export async function exportAuditLog(
  params: ListAuditParams = {},
): Promise<Blob> {
  const queryString =
    buildAuditQuery(params);

  const baseUrl =
    import.meta.env.VITE_API_BASE_URL
      ?.replace(/\/$/, "") ?? "";

  const response = await fetch(
    `${baseUrl}/api/v1/audit/export${
      queryString
        ? `?${queryString}`
        : ""
    }`,
    {
      method: "GET",
      headers: {
        ...tenantAuthHeaders(),
        Accept: "text/csv",
      },
    },
  );

  if (!response.ok) {
    let message =
      `Audit export failed with status ${response.status}`;

    try {
      const body =
        await response.text();

      if (body.trim()) {
        message = body;
      }
    } catch {
      // Keep default error message.
    }

    throw new Error(message);
  }

  return response.blob();
}