import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

// The "Consultation MVP" slice of
// Docs/vitals-to-consultation-pharmacy-closure-brainstorm.md §5/§13.5/§13.7.
// Matches ConsultationController field-for-field. Presenting complaint and
// vital signs are deliberately not duplicated here — read the visit's
// latest triage reading (shared/api/triage.ts's getLatestTriage) instead.
export type ConsultationStatus = "DRAFT" | "SIGNED" | "SUPERSEDED" | "ENTERED_IN_ERROR";
export type AllergyStatus = "UNKNOWN" | "NONE_KNOWN" | "KNOWN";
export type DiagnosisCertainty = "PROVISIONAL" | "CONFIRMED";
export type ConsultationOutcome =
  | "SEND_TO_PHARMACY"
  | "CONTINUE_INVESTIGATION"
  | "FINISH_NO_MEDICATION"
  | "REFER_OR_TRANSFER";

export interface ConsultationDiagnosis {
  id: string;
  diagnosisText: string;
  isPrimary: boolean;
  certainty: DiagnosisCertainty;
  sortOrder: number;
  codingSystem: string | null;
  catalogueVersion: string | null;
  code: string | null;
  displayText: string | null;
}

export interface Consultation {
  id: string;
  visitId: string;
  status: ConsultationStatus;
  supersedesConsultationId: string | null;
  amendmentReason: string | null;
  authorUserId: string;
  // Resolved server-side (ConsultationController) — "who consulted this
  // patient." createdAt (below) and signedAt double as this consultation's
  // start/end: there's no separate encounter-start moment distinct from the
  // draft being created, nor a finish moment distinct from signing.
  authorName: string | null;
  signedByUserId: string | null;
  signedByName: string | null;
  signedAt: string | null;
  relevantHistory: string | null;
  currentMedications: string | null;
  allergyStatus: AllergyStatus;
  allergyDetail: string | null;
  examinationNotes: string | null;
  investigationsNotes: string | null;
  treatmentPlan: string | null;
  outcome: ConsultationOutcome | null;
  outcomeNotes: string | null;
  createdAt: string;
  updatedAt: string;
  diagnoses: ConsultationDiagnosis[];
}

// Get-or-create — a second call against a visit that already has a draft
// returns that same draft rather than creating a sibling.
export async function createConsultationDraft(visitId: string): Promise<Consultation> {
  return apiClient.post<Consultation>(`/api/v1/visits/${visitId}/consultations`, undefined, {
    headers: tenantAuthHeaders(),
  });
}

// Full history, oldest first — DRAFT/SIGNED and SUPERSEDED/ENTERED_IN_ERROR
// entries alike.
export async function getConsultationHistory(visitId: string): Promise<Consultation[]> {
  const response = await apiClient.get<{ items: Consultation[] }>(`/api/v1/visits/${visitId}/consultations`, {
    headers: tenantAuthHeaders(),
  });
  return response.items;
}

// The visible consultation for a visit: its latest draft if one is in
// progress, else its latest signed one, else null (an ordinary, expected
// state for a visit that hasn't reached this step yet).
export async function getCurrentConsultation(visitId: string): Promise<Consultation | null> {
  const response = await apiClient.get<{ item: Consultation | null }>(
    `/api/v1/visits/${visitId}/consultations/current`,
    { headers: tenantAuthHeaders() },
  );
  return response.item;
}

export interface UpdateConsultationPayload {
  relevantHistory?: string;
  currentMedications?: string;
  allergyStatus: AllergyStatus;
  allergyDetail?: string;
  examinationNotes?: string;
  investigationsNotes?: string;
  treatmentPlan?: string;
}

// DRAFT only — a 409 (ApiError) means the consultation was signed since it
// was last loaded; refetch rather than retry.
export async function updateConsultationDraft(
  id: string,
  payload: UpdateConsultationPayload,
): Promise<Consultation> {
  return apiClient.patch<Consultation>(`/api/v1/consultations/${id}`, payload, { headers: tenantAuthHeaders() });
}

export interface AddDiagnosisPayload {
  diagnosisText: string;
  isPrimary: boolean;
  certainty: DiagnosisCertainty;
}

export async function addConsultationDiagnosis(
  id: string,
  payload: AddDiagnosisPayload,
): Promise<ConsultationDiagnosis> {
  return apiClient.post<ConsultationDiagnosis>(`/api/v1/consultations/${id}/diagnoses`, payload, {
    headers: tenantAuthHeaders(),
  });
}

export async function removeConsultationDiagnosis(id: string, diagnosisId: string): Promise<void> {
  await apiClient.delete<void>(`/api/v1/consultations/${id}/diagnoses/${diagnosisId}`, {
    headers: tenantAuthHeaders(),
  });
}

export interface PharmacyItemPayload {
  drugName: string;
  dosage: string;
  quantity: number;
}

export interface SignConsultationPayload {
  outcome: ConsultationOutcome;
  outcomeNotes?: string;
  // Required only when outcome is SEND_TO_PHARMACY — this is what actually
  // creates the prescription that shows up in the pharmacy facility's
  // dispensing queue; the queue-token transfer alone doesn't put anything
  // there for pharmacy staff to act on.
  pharmacyItems?: PharmacyItemPayload[];
  // Required only when outcome is REFER_OR_TRANSFER — the org's own
  // facility the clinician picked, not a hardcoded destination. Unlike
  // SEND_TO_PHARMACY (always the one org-wide pharmacy), a referral has no
  // single sensible default.
  destinationFacilityId?: string;
}

// Does not require a diagnosis first — a symptom-based assessment is
// permitted when a definitive diagnosis isn't available yet.
export async function signConsultation(id: string, payload: SignConsultationPayload): Promise<Consultation> {
  return apiClient.post<Consultation>(`/api/v1/consultations/${id}/sign`, payload, { headers: tenantAuthHeaders() });
}

export interface AmendConsultationPayload {
  relevantHistory?: string;
  currentMedications?: string;
  allergyStatus: AllergyStatus;
  allergyDetail?: string;
  examinationNotes?: string;
  investigationsNotes?: string;
  treatmentPlan?: string;
  diagnoses: AddDiagnosisPayload[];
  outcome: ConsultationOutcome;
  outcomeNotes?: string;
  amendmentReason: string;
  pharmacyItems?: PharmacyItemPayload[];
  destinationFacilityId?: string;
}

// A correction to a signed consultation never edits it in place — this
// returns a brand-new, already-signed consultation; the original becomes
// SUPERSEDED.
export async function amendConsultation(id: string, payload: AmendConsultationPayload): Promise<Consultation> {
  return apiClient.post<Consultation>(`/api/v1/consultations/${id}/amend`, payload, { headers: tenantAuthHeaders() });
}

// A pure mistake with nothing to replace it, unlike amendConsultation.
export async function markConsultationEnteredInError(id: string, reason: string): Promise<Consultation> {
  return apiClient.post<Consultation>(
    `/api/v1/consultations/${id}/entered-in-error`,
    { reason },
    { headers: tenantAuthHeaders() },
  );
}
