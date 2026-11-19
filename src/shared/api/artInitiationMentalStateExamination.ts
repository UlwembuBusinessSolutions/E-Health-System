import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export type MentalStateFinding = "NORMAL" | "ABNORMAL";

export interface ArtInitiationMentalStateExamination {
  id: string;
  visitId: string;
  finding: MentalStateFinding | null;
  normalComment: string | null;
  abnormalComment: string | null;
  updatedByUserId: string;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getArtInitiationMentalStateExamination(
  visitId: string,
): Promise<ArtInitiationMentalStateExamination | null> {
  const response = await apiClient.get<{ item: ArtInitiationMentalStateExamination | null }>(
    `/api/v1/visits/${visitId}/art-initiation-mental-state-examination`,
    { headers: tenantAuthHeaders() },
  );
  return response.item;
}

export async function saveArtInitiationMentalStateExamination(
  visitId: string,
  payload: { finding: MentalStateFinding | null; normalComment: string | null; abnormalComment: string | null },
): Promise<ArtInitiationMentalStateExamination> {
  return apiClient.put<ArtInitiationMentalStateExamination>(
    `/api/v1/visits/${visitId}/art-initiation-mental-state-examination`,
    payload,
    { headers: tenantAuthHeaders() },
  );
}
