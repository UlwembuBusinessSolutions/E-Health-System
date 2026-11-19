import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export interface ArtInitiationPriorHaartHistory {
  id: string;
  visitId: string;
  notes: string | null;
  updatedByUserId: string;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getArtInitiationPriorHaartHistory(
  visitId: string,
): Promise<ArtInitiationPriorHaartHistory | null> {
  const response = await apiClient.get<{ item: ArtInitiationPriorHaartHistory | null }>(
    `/api/v1/visits/${visitId}/art-initiation-prior-haart-history`,
    { headers: tenantAuthHeaders() },
  );
  return response.item;
}

export async function saveArtInitiationPriorHaartHistory(
  visitId: string,
  notes: string,
): Promise<ArtInitiationPriorHaartHistory> {
  return apiClient.put<ArtInitiationPriorHaartHistory>(
    `/api/v1/visits/${visitId}/art-initiation-prior-haart-history`,
    { notes },
    { headers: tenantAuthHeaders() },
  );
}
