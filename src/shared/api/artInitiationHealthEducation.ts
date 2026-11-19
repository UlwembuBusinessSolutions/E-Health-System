import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export interface ArtInitiationHealthEducation {
  id: string;
  visitId: string;
  condomImportance: boolean | null;
  healthyLifestyleDiet: boolean | null;
  partnerTesting: boolean | null;
  hivStatusDisclosure: boolean | null;
  adherenceCompliance: boolean | null;
  familyPlanning: boolean | null;
  generalHivInformation: boolean | null;
  regularPapSmear: boolean | null;
  medicationSideEffects: boolean | null;
  clinicAttendanceForHealthIssues: boolean | null;
  herbalTraditionalMedicationDiscussion: boolean | null;
  otherDiscussed: boolean | null;
  otherSpecify: string | null;
  updatedByUserId: string;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SaveArtInitiationHealthEducationPayload = Omit<
  ArtInitiationHealthEducation,
  "id" | "visitId" | "updatedByUserId" | "updatedByName" | "createdAt" | "updatedAt"
>;

export async function getArtInitiationHealthEducation(
  visitId: string,
): Promise<ArtInitiationHealthEducation | null> {
  const response = await apiClient.get<{ item: ArtInitiationHealthEducation | null }>(
    `/api/v1/visits/${visitId}/art-initiation-health-education`,
    { headers: tenantAuthHeaders() },
  );
  return response.item;
}

export async function saveArtInitiationHealthEducation(
  visitId: string,
  payload: SaveArtInitiationHealthEducationPayload,
): Promise<ArtInitiationHealthEducation> {
  return apiClient.put<ArtInitiationHealthEducation>(
    `/api/v1/visits/${visitId}/art-initiation-health-education`,
    payload,
    { headers: tenantAuthHeaders() },
  );
}
