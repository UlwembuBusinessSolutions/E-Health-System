import { apiClient, apiOrigin } from "./client";
import { tenantAuthHeaders } from "./auth";

export type ReferralType = "REFERRAL" | "TRANSFER";
export type ReferralStatus = "DRAFT" | "SUBMITTED" | "ACCEPTED" | "COMPLETED" | "CANCELLED";
export type ReferralFacilityType = "CLINIC" | "HOSPITAL";

export interface ReferralDestination {
  facilityId: string;
  facilityName: string;
  facilityType: ReferralFacilityType;
  telephoneNumber: string | null;
  organizationId: string;
  organizationName: string;
}

export interface IncomingReferralNotification {
  id: string;
  sourceOrganizationName: string;
  patientName: string;
  referralType: ReferralType;
  createdAt: string;
  status: ReferralStatus;
  acknowledged: boolean;
}

export interface IncomingReferralDetail {
  notificationId: string;
  sourceOrganizationName: string;
  referralId: string;
  patientId: string;
  referralType: ReferralType;
  status: ReferralStatus;
  referralDate: string;
  institutionName: string | null;
  reason: string | null;
  clinicalSummary: string | null;
  requiredMedication: string | null;
  medicationInstructions: string | null;
  additionalNotes: string | null;
  patientMpiNumber: string;
  patientName: string;
  patientDateOfBirth: string | null;
  patientGender: string | null;
  patientContactNumber: string;
}

export interface IncomingReferralAcceptance {
  patientId: string;
  mpiNumber: string;
  patientName: string;
  alreadyRegistered: boolean;
}

export async function listIncomingReferralNotifications(): Promise<IncomingReferralNotification[]> {
  return (await apiClient.get<{ items: IncomingReferralNotification[] }>("/api/v1/referral-notifications", {
    headers: tenantAuthHeaders(),
  })).items;
}

export function getIncomingReferralDetails(notificationId: string): Promise<IncomingReferralDetail> {
  return apiClient.get(`/api/v1/referral-notifications/${notificationId}`, {
    headers: tenantAuthHeaders(),
  });
}

export function acceptIncomingReferralNotification(notificationId: string): Promise<IncomingReferralAcceptance> {
  return apiClient.post(`/api/v1/referral-notifications/${notificationId}/accept`, {}, {
    headers: tenantAuthHeaders(),
  });
}

export function acknowledgeIncomingReferralNotification(notificationId: string): Promise<void> {
  return apiClient.post(`/api/v1/referral-notifications/${notificationId}/acknowledge`, {}, {
    headers: tenantAuthHeaders(),
  });
}

export async function listReferralDestinations(): Promise<ReferralDestination[]> {
  return (await apiClient.get<{ items: ReferralDestination[] }>("/api/v1/referral-destinations", {
    headers: tenantAuthHeaders(),
  })).items;
}

export interface PatientReferral {
  id: string;
  patientId: string;
  patientMpiNumber: string;
  patientName: string;
  patientDateOfBirth: string | null;
  patientContactNumber: string;
  referralType: ReferralType;
  destinationFacilityId: string | null;
  institutionName: string | null;
  contactPerson: string | null;
  telephoneNumber: string | null;
  faxNumber: string | null;
  referralDate: string;
  reason: string | null;
  clinicalSummary: string | null;
  requiredMedication: string | null;
  medicationInstructions: string | null;
  additionalNotes: string | null;
  status: ReferralStatus;
  initiatedByUserId: string;
  initiatedByName: string;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  acceptedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface ReferralPayload {
  referralType: ReferralType;
  destinationFacilityId?: string | null;
  institutionName?: string;
  contactPerson?: string;
  telephoneNumber?: string;
  faxNumber?: string;
  referralDate: string;
  reason?: string;
  clinicalSummary?: string;
  requiredMedication?: string;
  medicationInstructions?: string;
  additionalNotes?: string;
}

export interface ReferralDocument {
  id: string;
  referralId: string;
  patientId: string;
  originalFilename: string;
  contentType: string;
  fileSize: number;
  uploadedByUserId: string;
  uploadedAt: string;
}

export interface ReferralEvent {
  id: string;
  fromStatus: ReferralStatus | null;
  toStatus: ReferralStatus;
  actorUserId: string;
  actorName: string;
  note: string | null;
  occurredAt: string;
}

const patientPath = (patientId: string) => `/api/v1/patients/${patientId}/referrals`;
const referralPath = (patientId: string, referralId: string) => `${patientPath(patientId)}/${referralId}`;

export async function listPatientReferrals(patientId: string): Promise<PatientReferral[]> {
  return (await apiClient.get<{ items: PatientReferral[] }>(patientPath(patientId), { headers: tenantAuthHeaders() })).items;
}

export function createPatientReferral(patientId: string, payload: ReferralPayload): Promise<PatientReferral> {
  return apiClient.post(patientPath(patientId), payload, { headers: tenantAuthHeaders() });
}

export function updatePatientReferral(patientId: string, referralId: string, payload: ReferralPayload): Promise<PatientReferral> {
  return apiClient.patch(referralPath(patientId, referralId), payload, { headers: tenantAuthHeaders() });
}

export function changeReferralStatus(patientId: string, referralId: string, action: "submit" | "accept" | "complete" | "cancel") {
  return apiClient.post<PatientReferral>(`${referralPath(patientId, referralId)}/${action}`, {}, { headers: tenantAuthHeaders() });
}

export async function listReferralDocuments(patientId: string, referralId: string): Promise<ReferralDocument[]> {
  return (await apiClient.get<{ items: ReferralDocument[] }>(`${referralPath(patientId, referralId)}/documents`, {
    headers: tenantAuthHeaders(),
  })).items;
}

export function uploadReferralDocument(patientId: string, referralId: string, file: File): Promise<ReferralDocument> {
  const body = new FormData();
  body.append("file", file);
  return apiClient.post(`${referralPath(patientId, referralId)}/documents`, body, { headers: tenantAuthHeaders() });
}

export async function getReferralDocumentUrl(patientId: string, referralId: string, documentId: string): Promise<string> {
  return (await apiClient.get<{ url: string }>(
    `${referralPath(patientId, referralId)}/documents/${documentId}/download-url`, { headers: tenantAuthHeaders() },
  )).url;
}

export async function getReferralHistory(patientId: string, referralId: string): Promise<ReferralEvent[]> {
  return (await apiClient.get<{ items: ReferralEvent[] }>(`${referralPath(patientId, referralId)}/history`, {
    headers: tenantAuthHeaders(),
  })).items;
}

export async function getPrintableReferral(patientId: string, referralId: string): Promise<string> {
  const response = await fetch(`${apiOrigin()}${referralPath(patientId, referralId)}/print`, {
    headers: tenantAuthHeaders(),
  });
  if (!response.ok) throw new Error("Could not prepare the printable referral.");
  return response.text();
}
