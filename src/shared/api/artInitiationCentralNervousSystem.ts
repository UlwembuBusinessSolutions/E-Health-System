import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export type CentralNervousSystemFinding = "NORMAL" | "ABNORMAL";

export interface ArtInitiationCentralNervousSystem {
  id: string;
  visitId: string;
  finding: CentralNervousSystemFinding | null;
  normalComment: string | null;
  abnormalComment: string | null;
  updatedByUserId: string;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getArtInitiationCentralNervousSystem(
  visitId: string,
): Promise<ArtInitiationCentralNervousSystem | null> {
  const response = await apiClient.get<{ item: ArtInitiationCentralNervousSystem | null }>(
    `/api/v1/visits/${visitId}/art-initiation-central-nervous-system`,
    { headers: tenantAuthHeaders() },
  );
  return response.item;
}

export async function saveArtInitiationCentralNervousSystem(
  visitId: string,
  payload: {
    finding: CentralNervousSystemFinding | null;
    normalComment: string | null;
    abnormalComment: string | null;
  },
): Promise<ArtInitiationCentralNervousSystem> {
  return apiClient.put<ArtInitiationCentralNervousSystem>(
    `/api/v1/visits/${visitId}/art-initiation-central-nervous-system`,
    payload,
    { headers: tenantAuthHeaders() },
  );
}
