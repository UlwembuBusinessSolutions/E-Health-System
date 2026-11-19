import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export interface ArtInitiationClinicianDetails {
  id: string;
  visitId: string;
  signatureDataUrl: string | null;
  clinicianName: string | null;
  clinicianQualifications: string | null;
  sancNumber: string | null;
  hpcsaNumber: string | null;
  updatedByUserId: string;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveArtInitiationClinicianDetailsPayload {
  signatureDataUrl: string | null;
  clinicianName: string | null;
  clinicianQualifications: string | null;
  sancNumber: string | null;
  hpcsaNumber: string | null;
}

export async function getArtInitiationClinicianDetails(
  visitId: string,
): Promise<ArtInitiationClinicianDetails | null> {
  const response = await apiClient.get<{ item: ArtInitiationClinicianDetails | null }>(
    `/api/v1/visits/${visitId}/art-initiation-clinician-details`,
    { headers: tenantAuthHeaders() },
  );
  return response.item;
}

export async function saveArtInitiationClinicianDetails(
  visitId: string,
  payload: SaveArtInitiationClinicianDetailsPayload,
): Promise<ArtInitiationClinicianDetails> {
  return apiClient.put<ArtInitiationClinicianDetails>(
    `/api/v1/visits/${visitId}/art-initiation-clinician-details`,
    payload,
    { headers: tenantAuthHeaders() },
  );
}
