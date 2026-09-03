import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

// PHRM-US-001/009/018. Matches PrescriptionController field-for-field.
export type PrescriptionStatus = "PENDING" | "DISPENSED";

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
}

export interface CreatePrescriptionPayload {
  visitId: string;
  items: PrescriptionItem[];
}

// 403 if the caller has no current HPCSA/SANC registration
// (StaffService.getLicenseStatus()) — surfaced via ApiError same as any
// other rejected request.
export async function createPrescription(payload: CreatePrescriptionPayload): Promise<Prescription> {
  return apiClient.post<Prescription>("/api/v1/prescriptions", payload, { headers: tenantAuthHeaders() });
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
export async function dispensePrescription(id: string): Promise<void> {
  await apiClient.post<void>(`/api/v1/prescriptions/${id}/dispense`, undefined, { headers: tenantAuthHeaders() });
}
