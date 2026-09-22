import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

// -----------------------------------------------------------------------------
// PRESCRIPTIONS
// -----------------------------------------------------------------------------

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

export async function createPrescription(
  payload: CreatePrescriptionPayload,
): Promise<Prescription> {
  return apiClient.post<Prescription>(
    "/api/v1/prescriptions",
    payload,
    { headers: tenantAuthHeaders() },
  );
}

export async function listDispensingQueue(
  facilityId: string,
): Promise<Prescription[]> {
  const response = await apiClient.get<{ items: Prescription[] }>(
    `/api/v1/prescriptions/queue?facilityId=${encodeURIComponent(facilityId)}`,
    { headers: tenantAuthHeaders() },
  );

  return response.items;
}

export async function dispensePrescription(
  id: string,
): Promise<void> {
  await apiClient.post<void>(
    `/api/v1/prescriptions/${encodeURIComponent(id)}/dispense`,
    undefined,
    { headers: tenantAuthHeaders() },
  );
}

// -----------------------------------------------------------------------------
// STOCK
// -----------------------------------------------------------------------------

export interface StockBatch {
  id: string;
  facilityId: string;
  drugName: string;
  batchNumber: string;
  barcode: string;
  expiryDate: string;
  quantityOnHand: number;
  reorderLevel: number;
}

export type StockMovementType =
  | "RECEIPT"
  | "DISPENSE"
  | "WRITE_OFF"
  | "ADJUSTMENT"
  | "TRANSFER_OUT"
  | "TRANSFER_IN";

export interface StockMovement {
  id: string;
  facilityId: string;
  stockBatchId: string;
  drugName: string;
  movementType: StockMovementType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  performedByUserId: string;
  reason: string | null;
  prescriptionId: string | null;
  createdAt: string;
}

export interface ReceiveStockPayload {
  facilityId: string;
  drugName: string;
  batchNumber: string;
  barcode: string;
  expiryDate: string;
  quantity: number;
  reorderLevel: number;
}

export interface WriteOffPayload {
  quantity: number;
  reason: string;
}

export interface AdjustStockPayload {
  countedQuantity: number;
  reason: string;
}

export interface TransferStockPayload {
  sourceBatchId: string;
  destinationBatchId: string;
  quantity: number;
  reason: string;
}

// -----------------------------------------------------------------------------
// STOCK READS
// -----------------------------------------------------------------------------

export async function getExpiryWarnings(
  facilityId: string,
): Promise<StockBatch[]> {
  return apiClient.get<StockBatch[]>(
    `/api/v1/pharmacy/stock/expiry-warnings?facilityId=${encodeURIComponent(facilityId)}`,
    { headers: tenantAuthHeaders() },
  );
}

export async function getReorderAlerts(
  facilityId: string,
): Promise<StockBatch[]> {
  return apiClient.get<StockBatch[]>(
    `/api/v1/pharmacy/stock/reorder-alerts?facilityId=${encodeURIComponent(facilityId)}`,
    { headers: tenantAuthHeaders() },
  );
}

export async function getStockLedger(
  facilityId: string,
): Promise<StockMovement[]> {
  return apiClient.get<StockMovement[]>(
    `/api/v1/pharmacy/stock/ledger?facilityId=${encodeURIComponent(facilityId)}`,
    { headers: tenantAuthHeaders() },
  );
}

// Aliases retained for any other callers using the list-prefixed names.
export const listExpiryWarnings = getExpiryWarnings;
export const listReorderAlerts = getReorderAlerts;
export const listStockLedger = getStockLedger;

// -----------------------------------------------------------------------------
// STOCK WRITE OPERATIONS
// -----------------------------------------------------------------------------

export async function receiveStock(
  payload: ReceiveStockPayload,
): Promise<StockBatch> {
  return apiClient.post<StockBatch>(
    "/api/v1/pharmacy/stock",
    payload,
    { headers: tenantAuthHeaders() },
  );
}

export async function writeOffStock(
  batchId: string,
  payload: WriteOffPayload,
): Promise<StockBatch> {
  return apiClient.post<StockBatch>(
    `/api/v1/pharmacy/stock/${encodeURIComponent(batchId)}/write-off`,
    payload,
    { headers: tenantAuthHeaders() },
  );
}

export async function adjustStock(
  batchId: string,
  payload: AdjustStockPayload,
): Promise<StockBatch> {
  return apiClient.post<StockBatch>(
    `/api/v1/pharmacy/stock/${encodeURIComponent(batchId)}/adjust`,
    payload,
    { headers: tenantAuthHeaders() },
  );
}

export async function transferStock(
  payload: TransferStockPayload,
): Promise<void> {
  await apiClient.post<void>(
    "/api/v1/pharmacy/stock/transfer",
    payload,
    { headers: tenantAuthHeaders() },
  );
}
