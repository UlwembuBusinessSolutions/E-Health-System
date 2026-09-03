import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

// RECQ-US-001/002/004. Matches QueueController field-for-field.
export type TokenPriority = "NORMAL" | "PRIORITY";
export type TokenStatus = "ISSUED" | "CALLED";

export interface QueueToken {
  id: string;
  visitId: string;
  facilityId: string;
  tokenNumber: number;
  priority: TokenPriority;
  status: TokenStatus;
  manual: boolean;
  issuedAt: string;
  calledAt: string | null;
}

// The staff-facing queue view (patient name attached) — not the public
// waiting-room display RECQ-US-011 separately specifies as token-numbers-only;
// that's a different, unbuilt screen.
export interface QueueEntry {
  token: QueueToken;
  patientName: string;
  patientMpi: string;
}

export async function listQueue(facilityId: string): Promise<QueueEntry[]> {
  const response = await apiClient.get<{ items: QueueEntry[] }>(
    `/api/v1/queue?facilityId=${encodeURIComponent(facilityId)}`,
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}

// RECQ-US-002 — re-issues a token against a visit that already has one
// (or previously had one), flagged manual for reporting. The queue page's
// own "Boost to priority" action is this call with priority: "PRIORITY"
// against an existing row's own visitId, not a separate visit lookup form.
export async function issueManualToken(visitId: string, priority: TokenPriority): Promise<QueueToken> {
  return apiClient.post<QueueToken>("/api/v1/queue/tokens", { visitId, priority }, { headers: tenantAuthHeaders() });
}

// RECQ-US-004 — refuses (409) on an empty queue.
export async function callNext(facilityId: string): Promise<QueueEntry> {
  return apiClient.post<QueueEntry>(
    `/api/v1/queue/call-next?facilityId=${encodeURIComponent(facilityId)}`,
    undefined,
    { headers: tenantAuthHeaders() },
  );
}
