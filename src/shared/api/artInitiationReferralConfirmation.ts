import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export interface ArtInitiationReferralConfirmation {
  id: string;
  visitId: string;
  notes: string | null;
  updatedByUserId: string;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getArtInitiationReferralConfirmation(
  visitId: string,
): Promise<ArtInitiationReferralConfirmation | null> {
  const response = await apiClient.get<{ item: ArtInitiationReferralConfirmation | null }>(
    `/api/v1/visits/${visitId}/art-initiation-referral-confirmation`,
    { headers: tenantAuthHeaders() },
  );
  return response.item;
}

export async function saveArtInitiationReferralConfirmation(
  visitId: string,
  notes: string,
): Promise<ArtInitiationReferralConfirmation> {
  return apiClient.put<ArtInitiationReferralConfirmation>(
    `/api/v1/visits/${visitId}/art-initiation-referral-confirmation`,
    { notes },
    { headers: tenantAuthHeaders() },
  );
}
