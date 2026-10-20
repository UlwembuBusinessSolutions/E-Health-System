import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export interface VisitTiming {
  visitId: string;
  journeyVisitId: string;
  startedAt: string;
  firstVitalsAt: string | null;
  consultationStartedAt: string | null;
  consultationCompletedAt: string | null;
  finishedAt: string | null;
  completionReason: "CONSULTATION_FINISHED" | "VISIT_COMPLETED" | "VISIT_CANCELLED" | null;
  elapsedSeconds: number;
  beforeConsultationSeconds: number;
  consultationSeconds: number | null;
  active: boolean;
  asOf: string;
}
export function getVisitTiming(visitId: string): Promise<VisitTiming> {
  return apiClient.get(`/api/v1/visits/${visitId}/timing`, { headers: tenantAuthHeaders() });
}
export async function getPatientVisitTimings(patientId: string): Promise<VisitTiming[]> {
  const response = await apiClient.get<{ items: VisitTiming[] }>(`/api/v1/patients/${patientId}/visit-timings`, { headers: tenantAuthHeaders() });
  return response.items;
}
