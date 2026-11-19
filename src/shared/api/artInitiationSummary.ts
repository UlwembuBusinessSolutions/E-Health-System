import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export type ArtPriorTherapy = "NONE" | "PMTCT" | "HAART" | "PEP";

export interface ArtInitiationSummary {
  id: string;
  visitId: string;
  artStartDate: string | null;
  hivDiagnosisYear: number | null;
  priorTherapy: ArtPriorTherapy | null;
  details: string | null;
  updatedByUserId: string;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveArtInitiationSummaryPayload {
  artStartDate: string | null;
  hivDiagnosisYear: number | null;
  priorTherapy: ArtPriorTherapy | null;
  details: string | null;
}

export async function getArtInitiationSummary(visitId: string): Promise<ArtInitiationSummary | null> {
  const response = await apiClient.get<{ item: ArtInitiationSummary | null }>(
    `/api/v1/visits/${visitId}/art-initiation-summary-details`,
    { headers: tenantAuthHeaders() },
  );
  return response.item;
}

export async function saveArtInitiationSummary(
  visitId: string,
  payload: SaveArtInitiationSummaryPayload,
): Promise<ArtInitiationSummary> {
  return apiClient.put<ArtInitiationSummary>(
    `/api/v1/visits/${visitId}/art-initiation-summary-details`,
    payload,
    { headers: tenantAuthHeaders() },
  );
}
