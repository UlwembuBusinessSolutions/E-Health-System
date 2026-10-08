import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

// RECQ-US-008/009/010. Matches TriageController field-for-field.
export type ScoringProfile = "ADULT" | "PAEDIATRIC_OLDER_CHILD" | "PAEDIATRIC_YOUNGER_CHILD";
export type Avpu = "ALERT" | "CONFUSED" | "VOICE" | "PAIN" | "UNRESPONSIVE";
export type Mobility = "WALKING" | "MOBILE_WITH_ASSISTANCE" | "IMMOBILE";
export type OxygenSupport = "ROOM_AIR" | "SUPPLEMENTAL";
export type TriageColour = "GREEN" | "YELLOW" | "ORANGE" | "RED";
export type TriageAssessmentStatus = "ACTIVE" | "SUPERSEDED" | "ENTERED_IN_ERROR";

// A small, representative starter set, not the exhaustive licensed SATS
// discriminator list — TriageDiscriminator.java's own why-note.
export type TriageDiscriminator =
  | "CHEST_PAIN"
  | "DIFFICULTY_BREATHING"
  | "ACTIVE_BLEEDING"
  | "SUSPECTED_STROKE"
  | "ALTERED_MENTAL_STATUS"
  | "SEVERE_PAIN"
  | "SUSPECTED_FRACTURE"
  | "SEVERE_DEHYDRATION"
  | "PREGNANCY_COMPLICATION"
  | "OTHER";

export interface AdditionalObservations {
  traumaPresent?: boolean | null;
  weightKg?: number | null;
  heightCm?: number | null;
  glucoseMmolL?: number | null;
  haemoglobinGdl?: number | null;
  bmi?: number | null;
  urineProtein?: string | null;
  urineGlucose?: string | null;
  urineKetones?: string | null;
  urineBlood?: string | null;
  urineLeukocytes?: string | null;
  urineNitrites?: string | null;
  pregnancyTest?: string | null;
}

export interface TriageAssessment {
  additionalObservations?: AdditionalObservations | null;
  id: string;
  visitId: string;
  status: TriageAssessmentStatus;
  supersedesAssessmentId: string | null;
  correctionReason: string | null;
  emergencySign: boolean;
  emergencySignNote: string | null;
  scoringProfile: ScoringProfile;
  profileManuallyConfirmed: boolean;
  respiratoryRate: number | null;
  heartRate: number | null;
  systolicBp: number | null;
  diastolicBp: number | null;
  temperatureCelsius: number | null;
  spo2Percent: number | null;
  oxygenSupport: OxygenSupport;
  oxygenDevice: string | null;
  oxygenFlowLpm: number | null;
  avpu: Avpu | null;
  mobility: Mobility | null;
  painScore: number | null;
  painScale: string | null;
  presentingComplaint: string | null;
  outOfRangeConfirmed: boolean;
  validationWarnings: string | null;
  discriminators: TriageDiscriminator[];
  tewsScore: number | null;
  scoringVersion: string;
  calculatedColour: TriageColour;
  finalColour: TriageColour;
  overrideReason: string | null;
  overriddenByUserId: string | null;
  capturedByUserId: string;
  observedAt: string;
  recordedAt: string;
}

export interface CaptureTriagePayload {
  additionalObservations?: AdditionalObservations;
  emergencySign: boolean;
  emergencySignNote?: string;
  scoringProfileOverride?: ScoringProfile;
  respiratoryRate?: number;
  heartRate?: number;
  systolicBp?: number;
  diastolicBp?: number;
  temperatureCelsius?: number;
  spo2Percent?: number;
  oxygenSupport?: OxygenSupport;
  oxygenDevice?: string;
  oxygenFlowLpm?: number;
  avpu?: Avpu;
  mobility?: Mobility;
  painScore?: number;
  painScale?: string;
  presentingComplaint?: string;
  discriminators?: TriageDiscriminator[];
  supersedesAssessmentId?: string;
  idempotencyKey?: string;
  confirmOutOfRange?: boolean;
  clinicianConfirmedColour?: TriageColour;
  colourConfirmationReason?: string;
}

// RECQ-US-008/009/010 — one capture. `idempotencyKey` should be a fresh
// value per user-initiated submit (a uuid generated client-side), not
// reused across retries with different data: the backend treats a repeat
// of the same key on the same visit as "this exact request already
// happened," returning the original result rather than erroring.
export async function captureTriage(visitId: string, payload: CaptureTriagePayload): Promise<TriageAssessment> {
  return apiClient.post<TriageAssessment>(`/api/v1/visits/${visitId}/triage`, payload, {
    headers: tenantAuthHeaders(),
  });
}

// Full history, oldest first — ACTIVE and corrected/superseded entries
// alike, so the timeline shows both what's current and what changed.
export async function getTriageHistory(visitId: string): Promise<TriageAssessment[]> {
  const response = await apiClient.get<{ items: TriageAssessment[] }>(`/api/v1/visits/${visitId}/triage`, {
    headers: tenantAuthHeaders(),
  });
  return response.items;
}

export interface PatientVitalsEntry {
  assessment: TriageAssessment;
  capturedByName: string | null;
}

export interface PatientVitalsHistoryPage {
  items: PatientVitalsEntry[];
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
}

// The patient-level Vitals tab (PatientDetailPage) — every capture across
// every visit this patient has ever had, each one annotated with who
// captured it. `from`/`to` (yyyy-mm-dd) filter by observed date; either or
// both may be omitted to leave that side unbounded. `ascending` reverses
// the default newest-first order. Paginated the same shape listQueue()
// below already uses — page/pageSize in, items/page/pageSize/totalElements/
// totalPages out.
export async function getPatientVitalsHistory(
  patientId: string,
  filters?: { from?: string; to?: string; ascending?: boolean; page?: number; pageSize?: number },
): Promise<PatientVitalsHistoryPage> {
  const params = new URLSearchParams();
  if (filters?.from) params.set("from", filters.from);
  if (filters?.to) params.set("to", filters.to);
  if (filters?.ascending) params.set("ascending", "true");
  params.set("page", String(filters?.page ?? 0));
  params.set("pageSize", String(filters?.pageSize ?? 10));
  return apiClient.get<PatientVitalsHistoryPage>(`/api/v1/patients/${patientId}/vitals?${params.toString()}`, {
    headers: tenantAuthHeaders(),
  });
}

export interface VitalsAssessmentDetail {
  assessment: TriageAssessment;
  capturedByName: string | null;
  patientName: string;
  patientMpi: string;
}

// VitalsPrintPage — one assessment by id. Unlike PatientVitalsEntry above,
// this carries the patient's own name/MPI: the print page opens in a fresh
// popup with no surrounding page to show whose record it is, so that has to
// travel with the assessment itself (TriageService.getAssessment()'s own
// why-note on why this is a separate shape from the list endpoint).
export async function getVitalsAssessment(assessmentId: string): Promise<VitalsAssessmentDetail> {
  return apiClient.get<VitalsAssessmentDetail>(`/api/v1/triage/${assessmentId}`, { headers: tenantAuthHeaders() });
}

export async function getLatestTriage(visitId: string): Promise<TriageAssessment | null> {
  const response = await apiClient.get<{ item: TriageAssessment | null }>(`/api/v1/visits/${visitId}/triage/latest`, {
    headers: tenantAuthHeaders(),
  });
  return response.item;
}

// A pure mistake (wrong patient, fat-fingered) with nothing to replace —
// unlike capturing again with supersedesAssessmentId set, which corrects
// by replacing.
export async function markTriageEnteredInError(assessmentId: string, reason: string): Promise<TriageAssessment> {
  return apiClient.post<TriageAssessment>(
    `/api/v1/triage/${assessmentId}/entered-in-error`,
    { reason },
    { headers: tenantAuthHeaders() },
  );
}

export async function overrideTriageColour(
  assessmentId: string,
  finalColour: TriageColour,
  reason: string,
): Promise<TriageAssessment> {
  return apiClient.post<TriageAssessment>(
    `/api/v1/triage/${assessmentId}/override`,
    { finalColour, reason },
    { headers: tenantAuthHeaders() },
  );
}
