import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export type ArtStage = "STAGE_1" | "STAGE_2" | "STAGE_3" | "STAGE_4";

export interface ArtLongitudinalRecord {
  id: string;
  visitId: string;
  recordDate: string;
  durationOnArt: string | null;
  stage: ArtStage;
  viralLoad: string | null;
  cd4Count: string | null;
  stageDescription: string | null;
  signedByUserId: string;
  signedByName: string | null;
  signedAt: string;
  createdAt: string;
}

export interface SaveArtLongitudinalRecordPayload {
  recordDate: string;
  durationOnArt?: string;
  stage: ArtStage;
  viralLoad?: string;
  cd4Count?: string;
  stageDescription?: string;
}

export async function getArtLongitudinalRecords(visitId: string): Promise<ArtLongitudinalRecord[]> {
  const response = await apiClient.get<{ items: ArtLongitudinalRecord[] }>(
    `/api/v1/visits/${visitId}/art-longitudinal-records`,
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}

export async function saveArtLongitudinalRecord(
  visitId: string,
  payload: SaveArtLongitudinalRecordPayload,
): Promise<ArtLongitudinalRecord> {
  return apiClient.post<ArtLongitudinalRecord>(
    `/api/v1/visits/${visitId}/art-longitudinal-records`,
    payload,
    { headers: tenantAuthHeaders() },
  );
}
