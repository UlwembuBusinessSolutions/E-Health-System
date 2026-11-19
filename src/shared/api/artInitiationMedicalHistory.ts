import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export interface ArtInitiationMedicalHistory {
  id: string;
  visitId: string;
  notes: string | null;
  updatedByUserId: string;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getArtInitiationMedicalHistory(
  visitId: string,
): Promise<ArtInitiationMedicalHistory | null> {
  const response = await apiClient.get<{ item: ArtInitiationMedicalHistory | null }>(
    `/api/v1/visits/${visitId}/art-initiation-medical-history`,
    { headers: tenantAuthHeaders() },
  );
  return response.item;
}

export async function saveArtInitiationMedicalHistory(
  visitId: string,
  notes: string,
): Promise<ArtInitiationMedicalHistory> {
  return apiClient.put<ArtInitiationMedicalHistory>(
    `/api/v1/visits/${visitId}/art-initiation-medical-history`,
    { notes },
    { headers: tenantAuthHeaders() },
  );
}
