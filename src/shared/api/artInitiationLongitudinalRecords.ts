import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export type ArtInitiationStage = "STAGE_1" | "STAGE_2" | "STAGE_3" | "STAGE_4";

export interface ArtInitiationLongitudinalRecord {
  id: string;
  visitId: string;
  recordDate: string;
  durationOnArtMonths: number | null;
  stage: ArtInitiationStage;
  patientWeightKg: number | null;
  viralLoad: string | null;
  cd4Count: string | null;
  stageDescription: string | null;
  signedByUserId: string;
  signedByName: string | null;
  signedAt: string;
}

export interface SaveArtInitiationLongitudinalRecordPayload {
  recordDate: string;
  durationOnArtMonths: number | null;
  stage: ArtInitiationStage;
  patientWeightKg: number | null;
  viralLoad: string | null;
  cd4Count: string | null;
  stageDescription: string | null;
}

export async function getArtInitiationLongitudinalRecords(
  visitId: string,
): Promise<ArtInitiationLongitudinalRecord[]> {
  const response = await apiClient.get<{ items: ArtInitiationLongitudinalRecord[] }>(
    `/api/v1/visits/${visitId}/art-initiation-longitudinal-records`,
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}

export async function saveArtInitiationLongitudinalRecord(
  visitId: string,
  payload: SaveArtInitiationLongitudinalRecordPayload,
): Promise<ArtInitiationLongitudinalRecord> {
  return apiClient.post<ArtInitiationLongitudinalRecord>(
    `/api/v1/visits/${visitId}/art-initiation-longitudinal-records`,
    payload,
    { headers: tenantAuthHeaders() },
  );
}
