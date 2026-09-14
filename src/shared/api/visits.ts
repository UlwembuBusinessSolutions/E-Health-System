// Lihle | 2026-09-09 | Normalize array and paginated visit responses and reject malformed data so visit selectors can load supported backend responses.
import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";
import type { QueueToken } from "./queue";

// PREG-US-019 + RECQ-US-001. Matches VisitController field-for-field.
export type VisitType = "NEW" | "FOLLOW_UP";

// PREG-US-019's "visit type to service stream mapping" — borrows the app's
// own existing clinical-module names (ServiceStream.java's own why-note),
// not an invented taxonomy.
export type ServiceStream = "GENERAL" | "CHRONIC_CARE" | "MATERNAL_CHILD" | "OCCUPATIONAL_HEALTH";

export interface Visit {
  id: string;
  patientId: string;
  patientName: string;
  patientMpi: string;
  facilityId: string;
  visitType: VisitType;
  serviceStream: ServiceStream;
  visitDateTime: string;
  checkedInAt: string;
}

export interface CreateVisitPayload {
  patientId: string;
  facilityId: string;
  visitType: VisitType;
  serviceStream: ServiceStream;
}

// Creates the visit and, in the same call, issues its queue token —
// VisitService.createVisit()'s own why-note on why this is one atomic
// hand-off rather than two separate requests.
export interface VisitWithToken {
  visit: Visit;
  token: QueueToken;
}

export async function createVisit(payload: CreateVisitPayload): Promise<VisitWithToken> {
  return apiClient.post<VisitWithToken>("/api/v1/visits", payload, { headers: tenantAuthHeaders() });
}

export async function listVisits(): Promise<Visit[]> {
  const response = await apiClient.get<Visit[] | { items?: Visit[]; content?: Visit[] }>(
    "/api/v1/visits",
    { headers: tenantAuthHeaders() },
  );
  const visits = Array.isArray(response) ? response : response?.items ?? response?.content;
  if (!Array.isArray(visits)) {
    throw new Error("The server returned an invalid visit list. Please reload visits.");
  }
  return visits;
}

export async function getVisit(id: string): Promise<Visit> {
  return apiClient.get<Visit>(`/api/v1/visits/${id}`, { headers: tenantAuthHeaders() });
}
