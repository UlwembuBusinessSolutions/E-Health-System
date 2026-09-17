import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

// PHRM-US-001/009/018. Matches PrescriptionController field-for-field.
export type PrescriptionStatus = "PENDING" | "DISPENSED";
export type PrescriptionPriority = "PRIORITY" | "NORMAL";
export type VisitType = "NEW" | "FOLLOW_UP";
export type ServiceStream = "GENERAL" | "CHRONIC_CARE" | "MATERNAL_CHILD" | "OCCUPATIONAL_HEALTH";

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
  prescriberName: string;
  visitType: VisitType;
  serviceStream: ServiceStream;
  priority: PrescriptionPriority | null;
  tokenNumber: number | null;
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
export interface StockScan {
  barcode: string;
  quantity: number;
}

export async function dispensePrescription(id: string, scans: StockScan[]): Promise<void> {
  await apiClient.post<void>(`/api/v1/prescriptions/${id}/dispense`, { scans }, { headers: tenantAuthHeaders() });
}

export interface StockItem {
  drugName: string;
  quantityOnHand: number;
  reorderLevel: number;
  reorderAlert: boolean;
}

export interface StockMovement {
  id: string;
  facilityId: string;
  drugName: string;
  batchId: string | null;
  movementType: "RECEIPT" | "DISPENSE" | "ADJUSTMENT" | "WRITE_OFF";
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  referenceId: string | null;
  performedByUserId: string | null;
  createdAt: string;
}

export interface StockOverview {
  facilityId: string;
  items: StockItem[];
  movements: StockMovement[];
}

export async function getStockOverview(facilityId: string): Promise<StockOverview> {
  return apiClient.get<StockOverview>(`/api/v1/pharmacy/stock?facilityId=${encodeURIComponent(facilityId)}`, {
    headers: tenantAuthHeaders(),
  });
}

export interface ReceiveStockPayload {
  facilityId: string;
  drugName: string;
  batchNumber: string;
  barcode: string;
  expiryDate: string;
  quantity: number;
}

export async function receiveStock(payload: ReceiveStockPayload): Promise<void> {
  await apiClient.post<void>("/api/v1/pharmacy/stock", payload, { headers: tenantAuthHeaders() });
}
