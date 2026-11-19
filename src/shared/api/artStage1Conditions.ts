import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export type ArtStage1ConditionKey =
  | "persistentGeneralizedLymphadenopathy"
  | "stage1Other"
  | "stage2WeightLossUnder10Percent"
  | "stage2MinorMucocutaneousConditions"
  | "stage2RecurrentUrti"
  | "stage2Other"
  | "stage3WeightLossOver10Percent"
  | "stage3DiarrhoeaOverOneMonth"
  | "stage3OralCandidiasis"
  | "stage3SevereBacterialInfections"
  | "stage3OralHairyLeukoplakia"
  | "stage3ProlongedFever"
  | "stage3BedriddenUnder50Percent"
  | "stage3PulmonaryTb"
  | "stage3Other"
  | "stage4HerpesSimplexOverOneMonth"
  | "stage4OesophagealCandidiasis"
  | "stage4PneumocystisJiroveci"
  | "stage4KaposisSarcoma"
  | "stage4HivWastingSyndrome"
  | "stage4HivEncephalopathy"
  | "stage4RecurrentPneumonia"
  | "stage4Cytomegalovirus"
  | "stage4IsosporiasisCryptosporidiosis"
  | "stage4BedriddenOver50Percent"
  | "stage4CryptococcalMeningitis"
  | "stage4CervicalCancer"
  | "stage4Lymphoma"
  | "stage4ExtraPulmonaryTb";

export type ArtStage1ConditionsPayload = Record<ArtStage1ConditionKey, boolean | null> & {
  stage1OtherSpecify: string | null;
  stage2OtherSpecify: string | null;
  stage3OtherSpecify: string | null;
  cd4Result: string | null;
};

export interface ArtStage1Conditions extends ArtStage1ConditionsPayload {
  id: string;
  visitId: string;
  updatedByUserId: string;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getArtStage1Conditions(visitId: string): Promise<ArtStage1Conditions | null> {
  const response = await apiClient.get<{ item: ArtStage1Conditions | null }>(
    `/api/v1/visits/${visitId}/art-stage-1-conditions`,
    { headers: tenantAuthHeaders() },
  );
  return response.item;
}

export async function saveArtStage1Conditions(
  visitId: string,
  payload: ArtStage1ConditionsPayload,
): Promise<ArtStage1Conditions> {
  return apiClient.put<ArtStage1Conditions>(
    `/api/v1/visits/${visitId}/art-stage-1-conditions`,
    payload,
    { headers: tenantAuthHeaders() },
  );
}
