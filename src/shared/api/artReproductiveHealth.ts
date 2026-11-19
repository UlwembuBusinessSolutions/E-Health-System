import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export type ContraceptionMethod = "NONE" | "CONDOM" | "INJECTION" | "PILL" | "OTHER";

export interface ArtReproductiveHealthDetails {
  id: string;
  visitId: string;
  pregnant: boolean | null;
  trimester: number | null;
  gravida: string | null;
  para: string | null;
  contraceptionMethod: ContraceptionMethod | null;
  contraceptionOtherSpecify: string | null;
  urethralDischarge: boolean | null;
  urethralDischargeComment: string | null;
  vaginalDischarge: boolean | null;
  vaginalDischargeComment: string | null;
  genitalUlcers: boolean | null;
  genitalUlcersComment: string | null;
  genitalWarts: boolean | null;
  genitalWartsComment: string | null;
  lowerAbdominalPain: boolean | null;
  lowerAbdominalPainComment: string | null;
  papSmearResult: string | null;
  papSmearDate: string | null;
  rprDate: string | null;
  results: string | null;
  specifyTreatmentCompleted: string | null;
  updatedByUserId: string;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveArtReproductiveHealthDetailsPayload {
  pregnant: boolean | null;
  trimester: number | null;
  gravida: string | null;
  para: string | null;
  contraceptionMethod: ContraceptionMethod | null;
  contraceptionOtherSpecify: string | null;
  urethralDischarge: boolean | null;
  urethralDischargeComment: string | null;
  vaginalDischarge: boolean | null;
  vaginalDischargeComment: string | null;
  genitalUlcers: boolean | null;
  genitalUlcersComment: string | null;
  genitalWarts: boolean | null;
  genitalWartsComment: string | null;
  lowerAbdominalPain: boolean | null;
  lowerAbdominalPainComment: string | null;
  papSmearResult: string | null;
  papSmearDate: string | null;
  rprDate: string | null;
  results: string | null;
  specifyTreatmentCompleted: string | null;
}

export async function getArtReproductiveHealthDetails(visitId: string): Promise<ArtReproductiveHealthDetails | null> {
  const response = await apiClient.get<{ item: ArtReproductiveHealthDetails | null }>(
    `/api/v1/visits/${visitId}/art-reproductive-health-details`,
    { headers: tenantAuthHeaders() },
  );
  return response.item;
}

export async function saveArtReproductiveHealthDetails(
  visitId: string,
  payload: SaveArtReproductiveHealthDetailsPayload,
): Promise<ArtReproductiveHealthDetails> {
  return apiClient.put<ArtReproductiveHealthDetails>(
    `/api/v1/visits/${visitId}/art-reproductive-health-details`,
    payload,
    { headers: tenantAuthHeaders() },
  );
}
