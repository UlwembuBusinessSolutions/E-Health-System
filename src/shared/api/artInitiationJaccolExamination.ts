import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export type JaccolStatus = "PRESENT" | "ABSENT";

export interface ArtInitiationJaccolExamination {
  id: string;
  visitId: string;
  jStatus: JaccolStatus | null;
  jComment: string | null;
  aStatus: JaccolStatus | null;
  aComment: string | null;
  c1Status: JaccolStatus | null;
  c1Comment: string | null;
  c2Status: JaccolStatus | null;
  c2Comment: string | null;
  oStatus: JaccolStatus | null;
  oComment: string | null;
  lStatus: JaccolStatus | null;
  lComment: string | null;
  otherComment: string | null;
  notes: string | null;
  updatedByUserId: string;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SaveArtInitiationJaccolExaminationPayload = Omit<
  ArtInitiationJaccolExamination,
  "id" | "visitId" | "updatedByUserId" | "updatedByName" | "createdAt" | "updatedAt"
>;

export async function getArtInitiationJaccolExamination(
  visitId: string,
): Promise<ArtInitiationJaccolExamination | null> {
  const response = await apiClient.get<{ item: ArtInitiationJaccolExamination | null }>(
    `/api/v1/visits/${visitId}/art-initiation-jaccol-examination`,
    { headers: tenantAuthHeaders() },
  );
  return response.item;
}

export async function saveArtInitiationJaccolExamination(
  visitId: string,
  payload: SaveArtInitiationJaccolExaminationPayload,
): Promise<ArtInitiationJaccolExamination> {
  return apiClient.put<ArtInitiationJaccolExamination>(
    `/api/v1/visits/${visitId}/art-initiation-jaccol-examination`,
    payload,
    { headers: tenantAuthHeaders() },
  );
}
