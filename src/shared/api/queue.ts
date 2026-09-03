import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

// RECQ-US-001/002/004/005 + the out-and-back recall flow. Matches
// QueueController field-for-field.
export type TokenPriority = "NORMAL" | "PRIORITY";
export type TokenStatus = "ISSUED" | "CALLED" | "MISSED" | "COMPLETED" | "CANCELLED";

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
  missedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
}

// The staff-facing queue view (patient name attached) — not the public
// waiting-room display RECQ-US-011 separately specifies as token-numbers-only;
// that's a different, unbuilt screen.
export interface QueueEntry {
  token: QueueToken;
  patientName: string;
  patientMpi: string;
}

// RECQ-US-007 — `search` matches token number, patient name, or MPI, and is
// applied server-side. Always scoped to today (queue-system-improvements.md
// §1) — there is no "show me yesterday" mode, by design.
export async function listQueue(facilityId: string, search?: string): Promise<QueueEntry[]> {
  const params = new URLSearchParams({ facilityId });
  if (search) params.set("search", search);
  const response = await apiClient.get<{ items: QueueEntry[] }>(`/api/v1/queue?${params.toString()}`, {
    headers: tenantAuthHeaders(),
  });
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

// The out-and-back scenario, step one — the patient didn't respond to the
// call.
export async function markMissed(tokenId: string): Promise<QueueEntry> {
  return apiClient.post<QueueEntry>(`/api/v1/queue/tokens/${tokenId}/missed`, undefined, {
    headers: tenantAuthHeaders(),
  });
}

// Step two — the patient is back; re-inserted at their original priority
// and place in line.
export async function recallToken(tokenId: string): Promise<QueueEntry> {
  return apiClient.post<QueueEntry>(`/api/v1/queue/tokens/${tokenId}/recall`, undefined, {
    headers: tenantAuthHeaders(),
  });
}

export async function completeToken(tokenId: string): Promise<QueueEntry> {
  return apiClient.post<QueueEntry>(`/api/v1/queue/tokens/${tokenId}/complete`, undefined, {
    headers: tenantAuthHeaders(),
  });
}

export async function cancelToken(tokenId: string, reason: string): Promise<QueueEntry> {
  return apiClient.post<QueueEntry>(
    `/api/v1/queue/tokens/${tokenId}/cancel`,
    { reason },
    { headers: tenantAuthHeaders() },
  );
}
