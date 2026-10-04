import { apiClient, apiOrigin, ApiError } from "./client";
import { tenantAuthHeaders } from "./auth";
import { queryString } from "./queryString";
import type { DrugSchedule } from "./pharmacyStock";

// PHRM-US-001/009/018 and the stock-backed dispensing endpoints. Matches
// PrescriptionController and DispensingController field-for-field.
// PARTIALLY_DISPENSED only ever appears on a Prescription's own rollup
// status, never on a PrescriptionItem — some items resolved, at least one
// still pending (see PrescriptionStatus.java's own why-note on the backend).
export type PrescriptionStatus = "PENDING" | "DISPENSED" | "OUT_OF_STOCK" | "PARTIALLY_DISPENSED";

export type ItemStockStatus = "IN_STOCK" | "LOW" | "NONE";
// SUGGESTED: the drug name matches a mapping remembered from earlier, and
// `productId` holds that guess until a pharmacist confirms it.
export type MappingStatus = "CONFIRMED" | "SUGGESTED" | "UNMAPPED";
// Absent (null) means nobody has asked about a substitute for this item.
export type SubstitutionStatus = "REQUESTED" | "APPROVED" | "REJECTED";

// A batch the pharmacist may take stock from.
export interface DispenseLot {
  batchId: string;
  lot: string;
  expiryDate: string | null;
  available: number;
}

export interface ProductRef {
  id: string;
  name: string;
}

// Dispensing/out-of-stock happens per item now, not to the whole
// prescription at once — a pharmacy can dispense one line while marking
// another on the same script out of stock. Out of stock is never terminal:
// an item here can still move to DISPENSED once stock is back.
export interface PrescriptionItem {
  id: string;
  drugName: string;
  dosage: string;
  quantity: number;
  status: PrescriptionStatus;
  dispensedByName: string | null;
  dispensedAt: string | null;
  markedOutOfStockByName: string | null;
  markedOutOfStockAt: string | null;
  outOfStockNote: string | null;
  // The stock product this line is filled from, or the remembered guess when
  // `mappingStatus` is SUGGESTED. Stock is only deducted once CONFIRMED.
  productId: string | null;
  mappingStatus: MappingStatus;
  mappedProductName: string | null;
  // Differs from `productId` only when the prescriber approved a substitute;
  // every lot and stock figure below refers to this product.
  dispensingProductId: string | null;
  dispensingProductName: string | null;
  dispensedQuantity: number;
  remainingQuantity: number;
  returnedQuantity: number;
  availableQuantity: number;
  stockStatus: ItemStockStatus;
  // First-expiring-first-out pick; null when nothing usable is on the shelf.
  suggestedLot: DispenseLot | null;
  usableLots: DispenseLot[];
  skippedExpiredLots: DispenseLot[];
  schedule: DrugSchedule | null;
  substitutionStatus: SubstitutionStatus | null;
  substituteProductId: string | null;
  substituteProductName: string | null;
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
    `/api/v1/prescriptions/queue?${queryString({ facilityId })}`,
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}

// ---- Witnessing (Schedule 6) ----

// Schedule 6 medicine needs a second pharmacist. The server answers a
// dispense or hand-over that lacks one with this exact 422 message, and the
// screen then asks for a witness and sends the same request again with them.
export const WITNESS_REQUIRED_MESSAGE = "A second pharmacist must witness Schedule 6 medicine.";

export interface WitnessCredentials {
  witnessStaffId: string;
  /** The witness's own account password. */
  witnessPassword: string;
}

export interface LotQuantity {
  batchId: string;
  lot: string;
  expiryDate: string | null;
  quantity: number;
}

export interface DispenseItemPayload extends Partial<WitnessCredentials> {
  // Defaults server-side to everything still remaining.
  quantity?: number;
  // Defaults server-side to the first-expiring usable lot; never an expired one.
  batchId?: string;
}

export interface DispenseItemResult {
  itemId: string;
  status: PrescriptionStatus;
  dispensedNow: number;
  dispensedQuantity: number;
  remainingQuantity: number;
  lots: LotQuantity[];
}

// Dispenses one line item from stock (whole or part). Works even on an item
// currently OUT_OF_STOCK, since stock may have just come back; an already
// fully dispensed item is refused (409), as is insufficient stock or an
// expired lot.
export async function dispensePrescriptionItem(
  prescriptionId: string,
  itemId: string,
  payload: DispenseItemPayload,
): Promise<DispenseItemResult> {
  return apiClient.post<DispenseItemResult>(`/api/v1/prescriptions/${prescriptionId}/items/${itemId}/dispense`, payload, {
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

// ---- Queue extras: search and stock arrivals ----

// QUEUE: still to be dispensed. OUT_OF_STOCK: waiting for stock. DISPENSED: done.
export type SearchState = "QUEUE" | "OUT_OF_STOCK" | "DISPENSED";

export interface PrescriptionSearchResult {
  id: string;
  serialNumber: string;
  patientId: string;
  patientName: string;
  patientMpi: string;
  facilityId: string;
  status: PrescriptionStatus;
  queueState: SearchState;
  itemCount: number;
  dispensedItemCount: number;
  createdAt: string;
}

// Matches RX serial, patient name or patient MPI. Always asks for every state:
// the filter chips need counts for all of them, so filtering happens client-side.
export async function searchPrescriptions(query: string, facilityId: string): Promise<PrescriptionSearchResult[]> {
  const response = await apiClient.get<{ items: PrescriptionSearchResult[] }>(
    `/api/v1/prescriptions/search?${queryString({ q: query, state: "ALL", facilityId })}`,
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}

// An out-of-stock item whose product now has usable stock for it.
export interface StockArrival {
  prescriptionId: string;
  prescriptionSerial: string;
  patientId: string;
  patientName: string;
  patientMpi: string;
  itemId: string;
  drugName: string;
  productId: string;
  productName: string;
  remainingQuantity: number;
  availableQuantity: number;
  // False when only part of the remaining quantity has arrived ("8 of 20").
  canFulfilInFull: boolean;
  markedOutOfStockAt: string;
}

export async function listStockArrivals(facilityId: string): Promise<StockArrival[]> {
  const response = await apiClient.get<{ items: StockArrival[] }>(
    `/api/v1/pharmacy/stock-arrivals?${queryString({ facilityId })}`,
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}

// ---- Product mapping ----

export async function searchMappableProducts(query: string): Promise<ProductRef[]> {
  const response = await apiClient.get<{ items: { id: string; displayName: string }[] }>(
    `/api/v1/pharmacy/products?${queryString({ q: query, activeOnly: true, size: 8 })}`,
    { headers: tenantAuthHeaders() },
  );
  return response.items.map((product) => ({ id: product.id, name: product.displayName }));
}

// Confirms or overrides which stock product an item is filled from; the server
// remembers the choice so the same drug name is pre-selected next time.
// Answers with the whole prescription, but the screen refetches it anyway.
export async function setPrescriptionItemProduct(
  prescriptionId: string,
  itemId: string,
  productId: string,
): Promise<void> {
  await apiClient.put<Prescription>(`/api/v1/prescriptions/${prescriptionId}/items/${itemId}/product`, { productId }, {
    headers: tenantAuthHeaders(),
  });
}

// ---- Collection (hand-over) ----

export type CollectorIdType = "SA_ID" | "PASSPORT" | "OTHER";
export type CollectorRelationship =
  | "SPOUSE_PARTNER"
  | "PARENT"
  | "CHILD"
  | "SIBLING"
  | "CAREGIVER"
  | "COURIER"
  | "OTHER";
// Only WRITTEN (with a stored proof document) is accepted for Schedule 5/6
// medication; the server answers VERBAL with a 422.
export type AuthorisationType = "WRITTEN" | "VERBAL";

export interface CollectorDetails {
  name: string;
  idType: CollectorIdType;
  idNumber: string;
  // Free text on the server: a CollectorRelationship name, or the person's own
  // wording when the relationship is "Other".
  relationship: string;
  phone: string;
  authorisationType: AuthorisationType;
}

export interface CollectPayload extends Partial<WitnessCredentials> {
  // Omitted = every in-stock pending item.
  items?: string[];
  collectedByPatient: boolean;
  collector?: CollectorDetails;
  idVerified: boolean;
  // The collector's signature as a PNG data URL.
  signature?: string;
  // From `uploadCollectionProof`.
  proofRef?: string;
  notes?: string;
}

export interface HandedOverItem {
  itemId: string;
  drugName: string;
  quantity: number;
  lots: LotQuantity[];
}

export type SkipReason = "NOT_MAPPED" | "NO_USABLE_STOCK" | "INSUFFICIENT_STOCK" | "NOT_PENDING";

export interface SkippedItem {
  itemId: string;
  drugName: string;
  reason: SkipReason;
  // The server's plain-language explanation of the reason.
  message: string;
}

export interface CollectResult {
  // Null when nothing was in stock to hand over.
  collectionId: string | null;
  handedOver: HandedOverItem[];
  // Selected items that were left out and why; they stay pending.
  skipped: SkippedItem[];
}

// The proof of a third party's written authorisation is a binary file, so it
// is uploaded on its own and referenced from the hand-over by the returned ref.
export async function uploadCollectionProof(prescriptionId: string, file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const response = await apiClient.post<{ proofRef: string }>(
    `/api/v1/prescriptions/${prescriptionId}/collection-proof`,
    form,
    { headers: tenantAuthHeaders() },
  );
  return response.proofRef;
}

export async function collectPrescription(prescriptionId: string, payload: CollectPayload): Promise<CollectResult> {
  return apiClient.post<CollectResult>(`/api/v1/prescriptions/${prescriptionId}/collect`, payload, {
    headers: tenantAuthHeaders(),
  });
}

// Full third-party details. Reading them is audit-logged server-side, so the UI
// only asks when the pharmacist opens the hand-over record.
export interface CollectionDetails {
  collectedByPatient: boolean;
  collectorName: string | null;
  collectorIdType: CollectorIdType | null;
  collectorIdNumber: string | null;
  relationship: string | null;
  phone: string | null;
  authorisationType: AuthorisationType | null;
  proofUrl: string | null;
  signatureDataUrl: string | null;
  idVerified: boolean;
  notes: string | null;
  handedOverByName: string;
  handedOverAt: string;
}

export async function getCollectionDetails(prescriptionId: string): Promise<CollectionDetails> {
  return apiClient.get<CollectionDetails>(`/api/v1/prescriptions/${prescriptionId}/collection`, {
    headers: tenantAuthHeaders(),
  });
}

// The proof document sits behind the same login as everything else, so a plain
// link would be refused. It is fetched with the session headers and shown from
// a temporary local URL instead.
const PROOF_URL_LIFETIME_MS = 60_000;

export async function openCollectionProof(proofUrl: string): Promise<void> {
  const response = await fetch(`${apiOrigin()}${proofUrl}`, { headers: tenantAuthHeaders() });
  if (!response.ok) throw new ApiError(response.statusText, response.status);
  const localUrl = URL.createObjectURL(await response.blob());
  window.open(localUrl, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(localUrl), PROOF_URL_LIFETIME_MS);
}

// ---- Returns ----

export type ReturnCondition = "UNOPENED" | "DAMAGED" | "WRONG_ITEM";

export interface ReturnItemPayload {
  quantity: number;
  condition: ReturnCondition;
  reason: string;
}

// UNOPENED and WRONG_ITEM go back on the shelf; DAMAGED is written off.
export async function returnPrescriptionItem(
  prescriptionId: string,
  itemId: string,
  payload: ReturnItemPayload,
): Promise<void> {
  await apiClient.post<void>(`/api/v1/prescriptions/${prescriptionId}/items/${itemId}/return`, payload, {
    headers: tenantAuthHeaders(),
  });
}

// ---- Substitution ----

// Records the request and emails the prescriber. Nothing is dispensed from the
// substitute until they approve; `note` (at most 500 characters) is the text
// sent to them.
export async function requestSubstitution(
  prescriptionId: string,
  itemId: string,
  substituteProductId: string,
  note: string,
): Promise<void> {
  await apiClient.post<void>(
    `/api/v1/prescriptions/${prescriptionId}/items/${itemId}/substitution`,
    { substituteProductId, note },
    { headers: tenantAuthHeaders() },
  );
}

// The pharmacist records the prescriber's answer once they reply.
export async function decideSubstitution(
  prescriptionId: string,
  itemId: string,
  status: Extract<SubstitutionStatus, "APPROVED" | "REJECTED">,
): Promise<void> {
  await apiClient.patch<void>(`/api/v1/prescriptions/${prescriptionId}/items/${itemId}/substitution`, { status }, {
    headers: tenantAuthHeaders(),
  });
}
