import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

// PHRM-US-001/009/018. Matches PrescriptionController field-for-field.
export type PrescriptionStatus = "PENDING" | "HELD" | "DISPENSED" | "DECLINED";

export type DeclineReasonCode = "DUPLICATE_SUPPLY" | "CLINICALLY_INAPPROPRIATE" | "PATIENT_HAS_SUFFICIENT_SUPPLY" | "OTHER";
export interface DuplicateDispensingWarning {
  prescriptionId: string;
  drugName: string;
  dispensedAt: string;
  facilityId: string;
  facilityName: string;
  coverageUntil: string;
}
export interface PrescriptionDecline {
  id: string;
  prescriptionId: string;
  pharmacistId: string;
  prescriberId: string;
  reasonCode: DeclineReasonCode;
  reasonDetail: string | null;
  declinedAt: string;
}
export interface PrescriptionDeclineNotification {
  id: string;
  declineId: string;
  prescriptionId: string;
  createdAt: string;
}

export interface PrescriptionItem {
  drugName: string;
  dosage: string;
  quantity: number;
}

export interface Prescription {
  id: string;
  serialNumber: string;
  visitId: string;
  patientId: string;
  patientName: string;
  patientMpi: string;
  facilityId: string;
  prescriberId: string;
  status: PrescriptionStatus;
  items: PrescriptionItem[];
  createdAt: string;
  latestQuery?: PrescriptionQuerySummary | null;
}

export type PrescriptionQueryStatus = "OPEN" | "RESPONDED";

export interface PrescriptionQuerySummary {
  id: string;
  status: PrescriptionQueryStatus;
  reason: string;
  guidelineWarning?: string | null;
  prescriberResponse?: string | null;
  raisedAt: string;
  respondedAt?: string | null;
}

export interface PrescriptionQuery extends PrescriptionQuerySummary {
  prescriptionId: string;
  raisedByUserId: string;
  prescriberId: string;
}

export interface PrescriptionQueryNotification {
  id: string;
  queryId: string;
  type: "QUERY_RAISED" | "QUERY_RESPONDED";
  message: string;
  createdAt: string;
}

export interface CreatePrescriptionPayload {
  visitId: string;
  items: PrescriptionItem[];
  overrideReason?: string;
}

export type ClinicalRuleType = "DRUG_INTERACTION" | "CONTRAINDICATION";
export type ClinicalSeverity = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export interface ClinicalSafetyAlert {
  ruleId: string;
  type: ClinicalRuleType;
  severity: ClinicalSeverity;
  message: string;
  drugName: string;
  relatedTo: string;
}

export interface ManualVerificationCase {
  id: string;
  prescriptionId: string;
  patientId: string;
  reason: string;
  createdAt: string;
}

// 403 if the caller has no current HPCSA/SANC registration
// (StaffService.getLicenseStatus()) — surfaced via ApiError same as any
// other rejected request.
export async function createPrescription(payload: CreatePrescriptionPayload): Promise<Prescription> {
  return apiClient.post<Prescription>("/api/v1/prescriptions", payload, { headers: tenantAuthHeaders() });
}

export async function getPrescription(id: string): Promise<Prescription> {
  return apiClient.get<Prescription>(`/api/v1/prescriptions/${id}`, { headers: tenantAuthHeaders() });
}

export async function listPrescriptions(): Promise<Prescription[]> {
  const response = await apiClient.get<{ items: Prescription[] }>("/api/v1/prescriptions", {
    headers: tenantAuthHeaders(),
  });
  return response.items;
}

export async function getDispensedTodayCount(facilityId: string): Promise<number> {
  const response = await apiClient.get<{ dispensedToday: number }>(
    `/api/v1/prescriptions/stats?facilityId=${encodeURIComponent(facilityId)}`,
    { headers: tenantAuthHeaders() },
  );
  return response.dispensedToday;
}

export async function listDispensingQueue(facilityId: string): Promise<Prescription[]> {
  const response = await apiClient.get<{ items: Prescription[] }>(
    `/api/v1/prescriptions/queue?facilityId=${encodeURIComponent(facilityId)}`,
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}

// 403 if the caller has no current SAPC registration; 409 if this
// prescription was already dispensed.
export async function dispensePrescription(id: string, overrideReason?: string, coverageUntil?: string): Promise<void> {
  await apiClient.post<void>(`/api/v1/prescriptions/${id}/dispense`, { overrideReason, coverageUntil }, { headers: tenantAuthHeaders() });
}

export async function getDuplicateDispensingWarnings(id: string): Promise<DuplicateDispensingWarning[]> {
  const response = await apiClient.get<{ items: DuplicateDispensingWarning[] }>(
    `/api/v1/prescriptions/${id}/duplicate-warnings`, { headers: tenantAuthHeaders() });
  return response.items;
}

export async function declinePrescription(id: string, reasonCode: DeclineReasonCode, reasonDetail?: string): Promise<PrescriptionDecline> {
  return apiClient.post<PrescriptionDecline>(`/api/v1/prescriptions/${id}/decline`,
    { reasonCode, reasonDetail }, { headers: tenantAuthHeaders() });
}

export async function getPrescriptionDecline(id: string): Promise<PrescriptionDecline> {
  return apiClient.get<PrescriptionDecline>(`/api/v1/prescriptions/${id}/decline`, { headers: tenantAuthHeaders() });
}

export async function listPrescriptionDeclineNotifications(): Promise<PrescriptionDeclineNotification[]> {
  const response = await apiClient.get<{ items: PrescriptionDeclineNotification[] }>(
    "/api/v1/prescription-decline-notifications", { headers: tenantAuthHeaders() });
  return response.items;
}

export async function checkClinicalSafety(patientId: string, items: PrescriptionItem[]): Promise<ClinicalSafetyAlert[]> {
  const response = await apiClient.post<{ alerts: ClinicalSafetyAlert[] }>("/api/v1/prescriptions/safety-check", { patientId, items }, { headers: tenantAuthHeaders() });
  return response.alerts;
}

export async function previewPrescriptionQuery(id: string): Promise<ClinicalSafetyAlert[]> {
  const response = await apiClient.get<{ alerts: ClinicalSafetyAlert[] }>(
    `/api/v1/prescriptions/${id}/query-preview`,
    { headers: tenantAuthHeaders() },
  );
  return response.alerts;
}

export async function raisePrescriptionQuery(id: string, reason: string): Promise<PrescriptionQuery> {
  return apiClient.post<PrescriptionQuery>(
    `/api/v1/prescriptions/${id}/queries`,
    { reason },
    { headers: tenantAuthHeaders() },
  );
}

export async function respondToPrescriptionQuery(id: string, response: string): Promise<PrescriptionQuery> {
  return apiClient.post<PrescriptionQuery>(
    `/api/v1/prescription-queries/${id}/response`,
    { response },
    { headers: tenantAuthHeaders() },
  );
}

export async function listPrescriptionQueries(): Promise<PrescriptionQuery[]> {
  const response = await apiClient.get<{ items: PrescriptionQuery[] }>(
    "/api/v1/prescription-queries",
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}

export async function listPrescriptionQueryNotifications(): Promise<PrescriptionQueryNotification[]> {
  const response = await apiClient.get<{ items: PrescriptionQueryNotification[] }>(
    "/api/v1/prescription-query-notifications",
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}

// Get manual verification cases queue for prescriptions with identity issues
export async function listManualVerificationCases(): Promise<ManualVerificationCase[]> {
  const response = await apiClient.get<{ items: ManualVerificationCase[] }>(
    "/api/v1/prescriptions/manual-verification",
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}
