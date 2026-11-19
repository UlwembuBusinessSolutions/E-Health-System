import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export type MusculoskeletalFinding = "NORMAL" | "ABNORMAL";

export interface ArtInitiationMusculoskeletal {
  id: string;
  visitId: string;
  finding: MusculoskeletalFinding | null;
  comment: string | null;
  updatedByUserId: string;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getArtInitiationMusculoskeletal(
  visitId: string,
): Promise<ArtInitiationMusculoskeletal | null> {
  const response = await apiClient.get<{ item: ArtInitiationMusculoskeletal | null }>(
    `/api/v1/visits/${visitId}/art-initiation-musculoskeletal`,
    { headers: tenantAuthHeaders() },
  );
  return response.item;
}

export async function saveArtInitiationMusculoskeletal(
  visitId: string,
  finding: MusculoskeletalFinding | null,
  comment: string | null,
): Promise<ArtInitiationMusculoskeletal> {
  return apiClient.put<ArtInitiationMusculoskeletal>(
    `/api/v1/visits/${visitId}/art-initiation-musculoskeletal`,
    { finding, comment },
    { headers: tenantAuthHeaders() },
  );
}
