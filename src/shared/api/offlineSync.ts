import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";
import type { Patient, RegisterPatientPayload } from "./patients";

// Matches OfflineSyncController field-for-field.
export type SyncOutcome = "SYNCED" | "CONFLICT" | "REJECTED" | "RESOLVED" | "RETRY_LATER";

export interface SyncResult {
  clientRecordId: string;
  status: SyncOutcome;
  patientId: string | null;
  mpiNumber: string | null;
  conflictId: string | null;
  message: string | null;
}

export interface SyncRecordPayload {
  clientRecordId: string;
  capturedAt: string;
  data: RegisterPatientPayload;
}

const DEVICE_KEY = "ulwembu.deviceId";

// Stable per browser profile; informational only (stored on the sync record).
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = `web-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "web-unknown";
  }
}

// Always 200 when the request itself is acceptable — outcomes are per record.
export async function syncPatients(records: SyncRecordPayload[]): Promise<SyncResult[]> {
  const res = await apiClient.post<{ results: SyncResult[] }>(
    "/api/v1/patients/sync",
    { deviceId: getDeviceId(), records },
    { headers: tenantAuthHeaders() },
  );
  return res.results;
}

export interface SyncIssue {
  id: string;
  clientRecordId: string;
  status: "CONFLICT" | "REJECTED";
  conflictType: "ID_NUMBER_EXISTS" | null;
  message: string | null;
  offlineData: RegisterPatientPayload;
  existingPatient: Patient | null;
  capturedAt: string;
  receivedAt: string;
}

export async function listSyncIssues(): Promise<SyncIssue[]> {
  const res = await apiClient.get<{ items: SyncIssue[] }>("/api/v1/patients/sync/issues", {
    headers: tenantAuthHeaders(),
  });
  return res.items;
}

export type SyncResolution = "USE_EXISTING" | "APPLY_OFFLINE";

// ORG_ADMIN only (backend: /api/v1/admin/**).
export async function resolveSyncIssue(id: string, resolution: SyncResolution, reason: string): Promise<void> {
  await apiClient.post<void>(
    `/api/v1/admin/patients/sync/issues/${id}/resolve`,
    { resolution, reason },
    { headers: tenantAuthHeaders() },
  );
}