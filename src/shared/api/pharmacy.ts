import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

// Prescription and item statuses include partial supplies.
export type PrescriptionStatus = "PENDING" | "DISPENSED" | "OUT_OF_STOCK" | "PARTIALLY_DISPENSED" | "DECLINED";

export type DeclineReason = "SUFFICIENT_MEDICATION" | "DUPLICATE_THERAPY" | "CONTRAINDICATION" | "INTERACTION" | "DOSAGE_CONCERN" | "OTHER";
export interface SupplyWarning {
  supplyId: string; prescriptionItemId: string; dispensedAt: string;
  facilityId: string; facilityName: string; supplyUntil: string | null; quantity: number;
}
export const declineReasonLabels: Record<DeclineReason, string> = {
  SUFFICIENT_MEDICATION: "Patient already has sufficient medication",
  DUPLICATE_THERAPY: "Duplicate therapy", CONTRAINDICATION: "Contraindication",
  INTERACTION: "Medicine interaction", DOSAGE_CONCERN: "Dosage concern", OTHER: "Other",
};

// Dispensing/out-of-stock happens per item now, not to the whole
// prescription at once — a pharmacy can dispense one line while marking
// another on the same script out of stock. Out of stock is never terminal:
// an item here can still move to DISPENSED once stock is back.
export interface PrescriptionItem {
  id: string;
  drugName: string;
  dosage: string;
  quantity: number;
  dispensedQuantity: number;
  productId: string | null;
  productName: string | null;
  packSize: number | null;
  baseUnit: import("./pharmacyStock").StockBaseUnit | null;
  clinicalCheckStatus: "REVIEW_REQUIRED" | "PASSED";
  clinicalCheckNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  status: PrescriptionStatus;
  dispensedByName: string | null;
  dispensedAt: string | null;
  markedOutOfStockByName: string | null;
  markedOutOfStockAt: string | null;
  outOfStockNote: string | null;
  declineReason: DeclineReason | null;
  declineNote: string | null;
  declinedBy: string | null;
  declinedAt: string | null;
  duplicateWarnings: SupplyWarning[];
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
  // Resolved server-side (PrescriptionController.toResponse()) — null only
  // in the unlikely case the prescriber's own user record is gone.
  // registrationNumber prefers HPCSA, falling back to SANC.
  prescriberName: string | null;
  prescriberRegistrationNumber: string | null;
  // The pharmacy queue's Call/Message-prescriber affordances.
  prescriberPhone: string | null;
  prescriberEmail: string | null;
  consultationId: string | null;
  // A rollup of `items` — PENDING while every item still is,
  // PARTIALLY_DISPENSED while some are resolved but at least one still
  // needs action (that's what keeps this in the active queue), OUT_OF_STOCK
  // once nothing's left pending but at least one item is stuck there, else
  // DISPENSED.
  status: PrescriptionStatus;
  items: PrescriptionItem[];
  createdAt: string;
}

export interface PrescriptionItemInput {
  drugName: string;
  dosage: string;
  quantity: number;
}

export interface CreatePrescriptionPayload {
  visitId: string;
  items: PrescriptionItemInput[];
  // Optional traceability only — set when this prescription is created
  // from within a signed Consultation's "Send to pharmacy" outcome
  // (shared/api/consultations.ts). Omitting it behaves exactly as before
  // this field existed.
  consultationId?: string;
}

// 403 if the caller has no current HPCSA/SANC registration
// (StaffService.getLicenseStatus()), surfaced via ApiError same as any
// other rejected request.
export async function createPrescription(payload: CreatePrescriptionPayload): Promise<Prescription> {
  return apiClient.post<Prescription>("/api/v1/prescriptions", payload, { headers: tenantAuthHeaders() });
}

// PrescriptionPrintPage — fetches a single prescription by id, the same
// way VitalsPrintPage fetches one vitals assessment by id.
export async function getPrescription(id: string): Promise<Prescription> {
  return apiClient.get<Prescription>(`/api/v1/prescriptions/${id}`, { headers: tenantAuthHeaders() });
}

// The pharmacy "look up a prescription" utility — by serial number
// (RX-0000005), not a UUID, so a prescription that dropped off the active
// queue (every item out of stock, nothing left pending) can still be found
// and finished once stock is back. 404 (ApiError) if no such serial exists.
export async function getPrescriptionBySerial(serialNumber: string): Promise<Prescription> {
  return apiClient.get<Prescription>(`/api/v1/prescriptions/by-serial/${encodeURIComponent(serialNumber)}`, {
    headers: tenantAuthHeaders(),
  });
}

// The patient-level Medication tab (PatientDetailPage) — every prescription
// this patient has ever had, every status alike, newest first.
export async function getPatientPrescriptions(patientId: string): Promise<Prescription[]> {
  const response = await apiClient.get<{ items: Prescription[] }>(`/api/v1/patients/${patientId}/prescriptions`, {
    headers: tenantAuthHeaders(),
  });
  return response.items;
}

export async function listDispensingQueue(facilityId: string): Promise<Prescription[]> {
  const response = await apiClient.get<{ items: Prescription[] }>(
    `/api/v1/prescriptions/queue?facilityId=${encodeURIComponent(facilityId)}`,
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}

// Atomically supply explicit item quantities with their selected stock.
export async function dispenseAllPending(prescriptionId: string, items: { itemId: string; stock: DispensePayload }[]): Promise<void> {
  await apiClient.post<void>(`/api/v1/prescriptions/${prescriptionId}/dispense`, { items }, {
    headers: tenantAuthHeaders(),
  });
}

// Supply an exact base-unit quantity from the clinically reviewed product.
export async function dispensePrescriptionItem(prescriptionId: string, itemId: string, payload: DispensePayload): Promise<void> {
  await apiClient.post<void>(`/api/v1/prescriptions/${prescriptionId}/items/${itemId}/dispense`, payload, {
    headers: tenantAuthHeaders(),
  });
}

// Never removes the item — just records that it went unfilled and why
// (note optional). Safe to call again on an already-out-of-stock item to
// update the note; refused (409) only if the item's already been dispensed.
export async function markPrescriptionItemOutOfStock(
  prescriptionId: string,
  itemId: string,
  note?: string,
): Promise<void> {
  await apiClient.post<void>(`/api/v1/prescriptions/${prescriptionId}/items/${itemId}/out-of-stock`, { note }, {
    headers: tenantAuthHeaders(),
  });
}

export interface PrescriberMessage {
  id: string;
  senderName: string | null;
  message: string;
  sentAt: string;
}

// "Something else" — a pharmacy query about this prescription that isn't a
// stock or dispensing action. Sends a real email to the prescriber and
// returns the saved thread entry so the caller can show it immediately.
export async function sendPrescriberMessage(prescriptionId: string, message: string): Promise<PrescriberMessage> {
  return apiClient.post<PrescriberMessage>(`/api/v1/prescriptions/${prescriptionId}/message-prescriber`, { message }, {
    headers: tenantAuthHeaders(),
  });
}

export async function getPrescriberMessages(prescriptionId: string): Promise<PrescriberMessage[]> {
  const response = await apiClient.get<{ items: PrescriberMessage[] }>(
    `/api/v1/prescriptions/${prescriptionId}/messages`,
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}

export interface DispensePayload {
  productId: string; batchId: string; locationId: string; quantity: number;
  supplyUntil: string; acknowledgeDuplicateSupply: boolean; acknowledgedSupplyIds: string[];
}
export async function declinePrescriptionItem(prescriptionId: string, itemId: string, reasonCode: DeclineReason, note?: string): Promise<void> {
  await apiClient.post<void>(`/api/v1/prescriptions/${prescriptionId}/items/${itemId}/decline`, { reasonCode, note }, { headers: tenantAuthHeaders() });
}
export interface ReviewPayload { productId: string; status: "REVIEW_REQUIRED" | "PASSED"; note: string }
export async function reviewPrescriptionItem(prescriptionId: string, itemId: string, payload: ReviewPayload): Promise<void> {
  await apiClient.post<void>(`/api/v1/prescriptions/${prescriptionId}/items/${itemId}/review`, payload, { headers: tenantAuthHeaders() });
}
