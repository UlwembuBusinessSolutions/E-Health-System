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

  /*
   * Integrity-chain fields.
   *
   * These are generated and controlled by the database and are therefore
   * read-only from the application's perspective.
   */
  auditSequence: number;
  previousHash: string;
  integrityHash: string;

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

export async function listAuditLog(
  params: ListAuditParams = {},
): Promise<AuditEntry[]> {
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
    search.set("privileged", String(params.privileged));
  }

  const queryString = search.toString();

  const response = await apiClient.get<{
    items: AuditEntry[];
  }>(
    `/api/v1/audit${queryString ? `?${queryString}` : ""}`,
    {
      headers: tenantAuthHeaders(),
    },
  );

  return response.items;
}

/**
 * Export the audit trail as CSV.
 *
 * Uses exactly the same filter parameters as listAuditLog().
 *
 * The response is a Blob because the backend returns:
 *
 *     Content-Type: text/csv
 *
 * rather than JSON.
 */
export async function exportAuditLog(
  params: ListAuditParams = {},
): Promise<Blob> {
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
    search.set("privileged", String(params.privileged));
  }

  const queryString = search.toString();

  /*
   * Use the same API base URL as the rest of the frontend.
   *
   * VITE_API_BASE_URL is the value already used by the frontend Docker
   * configuration. When it is empty, the browser uses the current origin.
   */
  const baseUrl =
    import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

  const response = await fetch(
    `${baseUrl}/api/v1/audit/export${
      queryString ? `?${queryString}` : ""
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
    let message = `Audit export failed with status ${response.status}`;

    try {
      const body = await response.text();

      if (body.trim()) {
        message = body;
      }
    } catch {
      // Keep the default error message.
    }

    throw new Error(message);
  }

  return response.blob();
}

