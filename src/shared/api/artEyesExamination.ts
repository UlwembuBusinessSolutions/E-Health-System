import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export type EyeExaminationResult = "NORMAL" | "ABNORMAL";

export interface ArtEyesExamination {
  id: string;
  visitId: string;
  result: EyeExaminationResult;
  comments: string | null;
  recordedByUserId: string;
  recordedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getArtEyesExamination(visitId: string): Promise<ArtEyesExamination | null> {
  const response = await apiClient.get<{ item: ArtEyesExamination | null }>(
    `/api/v1/visits/${visitId}/art-eyes-examination`,
    { headers: tenantAuthHeaders() },
  );
  return response.item;
}

export async function saveArtEyesExamination(
  visitId: string,
  result: EyeExaminationResult,
  comments: string,
): Promise<ArtEyesExamination> {
  return apiClient.put<ArtEyesExamination>(
    `/api/v1/visits/${visitId}/art-eyes-examination`,
    { result, comments: comments.trim() || null },
    { headers: tenantAuthHeaders() },
  );
}
