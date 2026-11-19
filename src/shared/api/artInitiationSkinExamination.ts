import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export type SkinExaminationFinding = "NORMAL" | "ABNORMAL";

export interface ArtInitiationSkinExamination {
  id: string;
  visitId: string;
  finding: SkinExaminationFinding | null;
  normalComment: string | null;
  abnormalComment: string | null;
  updatedByUserId: string;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getArtInitiationSkinExamination(
  visitId: string,
): Promise<ArtInitiationSkinExamination | null> {
  const response = await apiClient.get<{ item: ArtInitiationSkinExamination | null }>(
    `/api/v1/visits/${visitId}/art-initiation-skin-examination`,
    { headers: tenantAuthHeaders() },
  );
  return response.item;
}

export async function saveArtInitiationSkinExamination(
  visitId: string,
  payload: {
    finding: SkinExaminationFinding | null;
    normalComment: string | null;
    abnormalComment: string | null;
  },
): Promise<ArtInitiationSkinExamination> {
  return apiClient.put<ArtInitiationSkinExamination>(
    `/api/v1/visits/${visitId}/art-initiation-skin-examination`,
    payload,
    { headers: tenantAuthHeaders() },
  );
}
