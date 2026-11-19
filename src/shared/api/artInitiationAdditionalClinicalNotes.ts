import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export interface ArtInitiationAdditionalClinicalNotes {
  id: string;
  visitId: string;
  notes: string | null;
  updatedByUserId: string;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getArtInitiationAdditionalClinicalNotes(
  visitId: string,
): Promise<ArtInitiationAdditionalClinicalNotes | null> {
  const response = await apiClient.get<{ item: ArtInitiationAdditionalClinicalNotes | null }>(
    `/api/v1/visits/${visitId}/art-initiation-additional-clinical-notes`,
    { headers: tenantAuthHeaders() },
  );
  return response.item;
}

export async function saveArtInitiationAdditionalClinicalNotes(
  visitId: string,
  notes: string,
): Promise<ArtInitiationAdditionalClinicalNotes> {
  return apiClient.put<ArtInitiationAdditionalClinicalNotes>(
    `/api/v1/visits/${visitId}/art-initiation-additional-clinical-notes`,
    { notes },
    { headers: tenantAuthHeaders() },
  );
}
