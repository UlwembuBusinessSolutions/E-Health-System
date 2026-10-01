import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

// RECQ-US-001/002/004/005 + the out-and-back recall flow. Matches
// QueueController field-for-field.
export type TokenPriority = "NORMAL" | "PRIORITY";
export type TokenStatus = "ISSUED" | "CALLED" | "MISSED" | "COMPLETED" | "CANCELLED";
export type QueueActionReason =
  | "CLINICAL_CONCERN"
  | "ELDERLY_PATIENT"
  | "PREGNANCY"
  | "DISABILITY_OR_MOBILITY"
  | "YOUNG_CHILD"
  | "RETURNED_AFTER_MISSED_CALL"
  | "CLINICIAN_REQUEST"
  | "OTHER";

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
  patientId: string;
  patientName: string;
  patientMpi: string;
}

export interface QueuePageResult {
  items: QueueEntry[];
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  date: string;
}

export interface QueueFilters {
  search?: string;
  statuses?: TokenStatus[];
  priority?: TokenPriority;
  date: string;
  page: number;
  pageSize: number;
}

export interface QueueReason {
  reasonCode: QueueActionReason;
  reasonNote?: string;
}

// RECQ-US-007 — `search` matches token number, patient name, or MPI, and is
// applied server-side. Always scoped to today (queue-system-improvements.md
// §1) — there is no "show me yesterday" mode, by design.
export async function listQueue(facilityId: string, filters: QueueFilters): Promise<QueuePageResult> {
  const params = new URLSearchParams({ facilityId });
  if (filters.search) params.set("search", filters.search);
  for (const status of filters.statuses ?? []) params.append("status", status);
  if (filters.priority) params.set("priority", filters.priority);
  params.set("date", filters.date);
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  return apiClient.get<QueuePageResult>(`/api/v1/queue?${params.toString()}`, {
    headers: tenantAuthHeaders(),
  });
}

// RECQ-US-003 — one token's full details, for the print/reprint ticket
// screen (TicketPrintPage). Not scoped to today: reprinting an older
// ticket is harmless even outside the live queue view.
export async function getQueueToken(tokenId: string): Promise<QueueEntry> {
  return apiClient.get<QueueEntry>(`/api/v1/queue/tokens/${tokenId}`, { headers: tenantAuthHeaders() });
}

// RECQ-US-002 — issues a genuinely NEW token against a visit that doesn't
// currently have an active one (a fresh walk-in intake, or a deliberate
// from-scratch re-queue). Not for boosting an already-waiting patient's
// priority — that's updateTokenPriority() below, which changes the
// existing token in place instead of creating a second one.
export async function issueManualToken(visitId: string, priority: TokenPriority): Promise<QueueToken> {
  return apiClient.post<QueueToken>("/api/v1/queue/tokens", { visitId, priority }, { headers: tenantAuthHeaders() });
}

// The queue page's "Boost to priority" action — changes an existing
// token's priority in place, no new token/token-number involved.
export async function updateTokenPriority(
  tokenId: string,
  priority: TokenPriority,
  reason: QueueReason,
): Promise<QueueEntry> {
  return apiClient.patch<QueueEntry>(
    `/api/v1/queue/tokens/${tokenId}/priority`,
    { priority, ...reason },
    { headers: tenantAuthHeaders() },
  );
}

export async function callToken(tokenId: string, reason?: QueueReason): Promise<QueueEntry> {
  return apiClient.post<QueueEntry>(`/api/v1/queue/tokens/${tokenId}/call`, reason, {
    headers: tenantAuthHeaders(),
  });
}

export async function reactivateToken(tokenId: string, reason: QueueReason): Promise<QueueEntry> {
  return apiClient.post<QueueEntry>(`/api/v1/queue/tokens/${tokenId}/reactivate`, reason, {
    headers: tenantAuthHeaders(),
  });
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

// Cancels this ticket and issues a brand-new one at destinationFacilityId
// against a brand-new visit — the returned QueueEntry is the NEW token, at
// the destination facility, not the one just cancelled. Only valid while
// the ticket is ISSUED, CALLED, or MISSED, same states cancelToken() allows.
export async function transferToken(
  tokenId: string,
  destinationFacilityId: string,
  reason?: string,
): Promise<QueueEntry> {
  return apiClient.post<QueueEntry>(
    `/api/v1/queue/tokens/${tokenId}/transfer`,
    { destinationFacilityId, reason },
    { headers: tenantAuthHeaders() },
  );
}
