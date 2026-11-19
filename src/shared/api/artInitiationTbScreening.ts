import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export interface ArtInitiationTbScreening {
  id: string;
  visitId: string;
  previousTb: boolean | null;
  previousTbYear: number | null;
  previousTbExtraPulmonary: boolean | null;
  previousTbPulmonary: boolean | null;
  currentTb: boolean | null;
  currentTbExtraPulmonary: boolean | null;
  currentTbPulmonary: boolean | null;
  currentTbTreatmentStartDate: string | null;
  symptomCoughOverTwoWeeks: boolean | null;
  symptomWeightLoss: boolean | null;
  symptomFever: boolean | null;
  symptomNightSweats: boolean | null;
  symptomHaemoptysis: boolean | null;
  symptomFatigue: boolean | null;
  smearDateResult: string | null;
  cultureSensitivityDateResult: string | null;
  clinicalIndication: string | null;
  updatedByUserId: string;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SaveArtInitiationTbScreeningPayload = Omit<
  ArtInitiationTbScreening,
  "id" | "visitId" | "updatedByUserId" | "updatedByName" | "createdAt" | "updatedAt"
>;

export async function getArtInitiationTbScreening(visitId: string): Promise<ArtInitiationTbScreening | null> {
  const response = await apiClient.get<{ item: ArtInitiationTbScreening | null }>(
    `/api/v1/visits/${visitId}/art-initiation-tb-screening`,
    { headers: tenantAuthHeaders() },
  );
  return response.item;
}

export async function saveArtInitiationTbScreening(
  visitId: string,
  payload: SaveArtInitiationTbScreeningPayload,
): Promise<ArtInitiationTbScreening> {
  return apiClient.put<ArtInitiationTbScreening>(
    `/api/v1/visits/${visitId}/art-initiation-tb-screening`,
    payload,
    { headers: tenantAuthHeaders() },
  );
}
