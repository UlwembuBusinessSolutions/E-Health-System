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

export type TriageColour = "RED" | "ORANGE" | "YELLOW" | "GREEN" | "BLUE";
export type Avpu = "ALERT" | "VOICE" | "PAIN" | "UNRESPONSIVE";
export type Mobility = "AMBULANT" | "WITH_HELP" | "IMMOBILE";

export interface TriagePayload {
  respiratoryRate: number;
  pulseRate: number;
  systolicBp: number;
  temperature: number;
  avpu: Avpu;
  mobility: Mobility;
  trauma: boolean;
  deceased: boolean;
  overrideColour?: TriageColour;
  overrideReason?: string;
}

export interface TriageResult {
  id: string;
  tewsScore: number;
  calculatedColour: TriageColour;
  assignedColour: TriageColour;
  slaMinutes: number | null;
  sla: string;
  overrideReason: string | null;
  recordedAt: string;
}

export async function recordTriage(visitId: string, payload: TriagePayload): Promise<TriageResult> {
  return apiClient.post<TriageResult>(`/api/v1/visits/${visitId}/triage`, payload, {
    headers: tenantAuthHeaders(),
  });
}
