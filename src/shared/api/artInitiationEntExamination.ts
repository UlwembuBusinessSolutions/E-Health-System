import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export type EntExaminationFinding = "NORMAL" | "ABNORMAL";

export interface ArtInitiationEntExamination {
  id: string;
  visitId: string;
  finding: EntExaminationFinding | null;
  normalComment: string | null;
  abnormalComment: string | null;
  updatedByUserId: string;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getArtInitiationEntExamination(visitId: string): Promise<ArtInitiationEntExamination | null> {
  const response = await apiClient.get<{ item: ArtInitiationEntExamination | null }>(
    `/api/v1/visits/${visitId}/art-initiation-ent-examination`,
    { headers: tenantAuthHeaders() },
  );
  return response.item;
}

export async function saveArtInitiationEntExamination(
  visitId: string,
  payload: { finding: EntExaminationFinding | null; normalComment: string | null; abnormalComment: string | null },
): Promise<ArtInitiationEntExamination> {
  return apiClient.put<ArtInitiationEntExamination>(
    `/api/v1/visits/${visitId}/art-initiation-ent-examination`,
    payload,
    { headers: tenantAuthHeaders() },
  );
}
