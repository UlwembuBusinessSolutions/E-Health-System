import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";
import type { QueueToken } from "./queue";

// PREG-US-019 + RECQ-US-001. Matches VisitController field-for-field.
export type VisitType = "NEW" | "FOLLOW_UP";

// PREG-US-019's "visit type to service stream mapping" — borrows the app's
// own existing clinical-module names (ServiceStream.java's own why-note),
// not an invented taxonomy.
export type ServiceStream = "GENERAL" | "CHRONIC_CARE" | "MATERNAL_CHILD" | "OCCUPATIONAL_HEALTH";

export const SERVICE_STREAM_DETAILS: Record<ServiceStream, { label: string; code: string }> = {
  GENERAL: { label: "General / acute care", code: "A" },
  CHRONIC_CARE: { label: "Chronic care", code: "C" },
  OCCUPATIONAL_HEALTH: { label: "Occupational health", code: "O" },
  MATERNAL_CHILD: { label: "Maternal & child health", code: "N" },
};

export interface Visit {
  id: string;
  patientId: string | null;
  facilityId: string;
  visitType: VisitType;
  serviceStream: ServiceStream;
  visitDateTime: string;
}

export interface CreateVisitPayload {
  patientId: string;
  facilityId: string;
  visitType: VisitType;
  serviceStream: ServiceStream;
}

export interface CreateWalkInVisitPayload {
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

// Creates a walk-in visit and queue token without creating an unverified
// patient record.
export async function createWalkInVisit(payload: CreateWalkInVisitPayload): Promise<VisitWithToken> {
  return apiClient.post<VisitWithToken>("/api/v1/visits/walk-in", payload, { headers: tenantAuthHeaders() });
}

export async function getVisit(visitId: string): Promise<Visit> {
  return apiClient.get<Visit>(`/api/v1/visits/${visitId}`, { headers: tenantAuthHeaders() });
}

// The patient record's Visits tab — every visit this patient has ever had,
// across every facility, newest first. facilityName travels with each row
// (resolved server-side) so the page never has to look it up itself.
export interface PatientVisit {
  id: string;
  facilityId: string;
  facilityName: string | null;
  visitType: VisitType;
  serviceStream: ServiceStream;
  visitDateTime: string;
  transferredFromVisitId: string | null;
}

export async function getPatientVisitHistory(patientId: string): Promise<PatientVisit[]> {
  const response = await apiClient.get<{ items: PatientVisit[] }>(`/api/v1/patients/${patientId}/visits`, {
    headers: tenantAuthHeaders(),
  });
  return response.items;
}
