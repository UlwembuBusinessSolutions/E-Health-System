import { apiClient, apiOrigin, ApiError } from "./client";
import { tenantAuthHeaders } from "./auth";

// PHRM-US-001/009/018. Matches PrescriptionController field-for-field.
// PARTIALLY_DISPENSED only ever appears on a Prescription's own rollup
// status, never on a PrescriptionItem — some items resolved, at least one
// still pending (see PrescriptionStatus.java's own why-note on the backend).
export type PrescriptionStatus = "PENDING" | "DISPENSED" | "OUT_OF_STOCK" | "PARTIALLY_DISPENSED";

// ---- Stock-backed dispensing (contract section 3, B3) ----

export type ScheduleCode = "S5" | "S6";
export type ItemStockStatus = "IN_STOCK" | "LOW" | "NONE";
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

// Offered when an item has no usable stock but a close alternative does.
export interface SubstituteSuggestion {
  productId: string;
  productName: string;
  lot: string;
  expiryDate: string | null;
  available: number;
  // Why it is a reasonable alternative, e.g. "Same class: cephalosporin injection".
  basis: string;
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
  // The stock product this line is filled from. Null until a pharmacist (or the
  // remembered drug-name mapping) links it; `suggestedProduct` is the server's best guess.
  productId: string | null;
  mappedProductName: string | null;
  suggestedProduct: ProductRef | null;
  dispensedQuantity: number;
  remainingQuantity: number;
  returnedQuantity: number;
  stockStatus: ItemStockStatus;
  schedule: ScheduleCode | null;
  // First-expiring-first-out pick; null when nothing usable is on the shelf.
  suggestedLot: DispenseLot | null;
  usableLots: DispenseLot[];
  skippedExpiredLots: DispenseLot[];
  substitutionStatus: SubstitutionStatus | null;
  substituteSuggestion: SubstituteSuggestion | null;
}

// What the queue and search show about a completed hand-over. The collector's
// ID number arrives already masked; full details need getCollectionDetails().
export interface CollectionSummary {
  collectedByPatient: boolean;
  collectorName: string | null;
  relationship: string | null;
  maskedIdNumber: string | null;
  handedOverByName: string;
  handedOverAt: string;
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
  // Latest hand-over, if any item has been collected.
  collection: CollectionSummary | null;
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

// "Mark all as collected" — dispenses every item still PENDING on this
// prescription; an item already OUT_OF_STOCK is left untouched (there's
// nothing to hand over until stock is actually back). 403 if the caller has
// no current SAPC registration.
export async function dispenseAllPending(prescriptionId: string): Promise<void> {
  await apiClient.post<void>(`/api/v1/prescriptions/${prescriptionId}/dispense`, undefined, {
    headers: tenantAuthHeaders(),
  });
}

export interface DispenseItemPayload {
  // Defaults server-side to everything still remaining.
  quantity?: number;
  // Defaults server-side to the first-expiring usable lot; never an expired one.
  batchId?: string;
}

// Dispenses one line item from stock (whole or part). Works even on an item
// currently OUT_OF_STOCK, since stock may have just come back; an already
// fully dispensed item is refused (409), as is insufficient stock or an
// expired lot. The key identifies this ATTEMPT, so a retry after a network
// error cannot deduct stock twice.
export async function dispensePrescriptionItem(
  prescriptionId: string,
  itemId: string,
  payload: DispenseItemPayload,
  idempotencyKey: string,
): Promise<void> {
  await apiClient.post<void>(`/api/v1/prescriptions/${prescriptionId}/items/${itemId}/dispense`, payload, {
    headers: { ...tenantAuthHeaders(), "Idempotency-Key": idempotencyKey },
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

// ---- Queue extras: facility-scoped queue, search, stock arrivals ----

export type SearchState = "QUEUE" | "OUT_OF_STOCK" | "DISPENSED";

export interface PrescriptionSearchResult {
  prescriptionId: string;
  serialNumber: string;
  patientName: string;
  patientMpi: string;
  issuedAt: string;
  // e.g. "Amoxicillin x 21, Ceftriaxone x 1" — enough to recognise the script.
  itemsSummary: string;
  state: SearchState;
  hasOutOfStockItem: boolean;
}

// Matches RX serial, patient name or patient MPI. Always asks for every state:
// the filter chips need counts for all of them, so filtering happens client-side.
export async function searchPrescriptions(query: string, facilityId: string): Promise<PrescriptionSearchResult[]> {
  const params = new URLSearchParams({ q: query, state: "ALL", facilityId });
  const response = await apiClient.get<{ items: PrescriptionSearchResult[] }>(
    `/api/v1/prescriptions/search?${params.toString()}`,
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}

// An out-of-stock item whose product now has enough usable stock to fill it.
export interface StockArrival {
  prescriptionId: string;
  serialNumber: string;
  patientName: string;
  itemId: string;
  drugName: string;
  available: number;
  lot: string;
}

export async function listStockArrivals(facilityId: string): Promise<StockArrival[]> {
  const response = await apiClient.get<{ items: StockArrival[] }>(
    `/api/v1/pharmacy/stock-arrivals?facilityId=${encodeURIComponent(facilityId)}`,
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}

// ---- Product mapping ----

export async function searchMappableProducts(query: string): Promise<ProductRef[]> {
  const params = new URLSearchParams({ q: query, activeOnly: "true", size: "8" });
  const response = await apiClient.get<{ items: { id: string; displayName: string }[] }>(
    `/api/v1/pharmacy/products?${params.toString()}`,
    { headers: tenantAuthHeaders() },
  );
  return response.items.map((product) => ({ id: product.id, name: product.displayName }));
}

// apiClient has no PUT yet (client.ts is shared and owned elsewhere), so this
// one endpoint speaks fetch directly and mirrors its error shape. Replace with
// `apiClient.put` once the client grows one.
async function putJson(path: string, body: unknown): Promise<void> {
  const response = await fetch(`${apiOrigin()}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...tenantAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (response.ok) return;
  const problem = (await response.json().catch(() => null)) as { message?: string; code?: string } | null;
  throw new ApiError(problem?.message ?? response.statusText, response.status, undefined, { code: problem?.code });
}

// Confirms or overrides which stock product an item is filled from; the server
// remembers the choice so the same drug name is pre-selected next time.
export async function setPrescriptionItemProduct(
  prescriptionId: string,
  itemId: string,
  productId: string,
): Promise<void> {
  await putJson(`/api/v1/prescriptions/${prescriptionId}/items/${itemId}/product`, { productId });
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
// VERBAL is never accepted for Schedule 5/6 medication (server answers 422).
export type AuthorisationType = "WRITTEN_CONSENT" | "VERBAL" | "LEGAL_GUARDIAN" | "POWER_OF_ATTORNEY";

export interface CollectorDetails {
  name: string;
  idType: CollectorIdType;
  idNumber: string;
  relationship: CollectorRelationship;
  // Required when relationship is OTHER.
  relationshipDescription?: string;
  phone: string;
  authorisationType: AuthorisationType;
}

export interface CollectPayload {
  // Omitted = every in-stock pending item.
  items?: string[];
  collectedByPatient: boolean;
  collector?: CollectorDetails;
  idVerified: boolean;
  notes?: string;
}

export interface CollectFiles {
  signature?: Blob;
  proof?: File;
}

export interface SkippedItem {
  itemId: string;
  drugName: string;
  reason: "OUT_OF_STOCK" | "NO_USABLE_LOT" | "UNMAPPED";
}

export interface CollectResult {
  prescription: Prescription;
  // Pending items that had no usable stock and stayed pending.
  skippedItems: SkippedItem[];
}

// Sent as multipart (JSON `payload` part + optional `signature` / `proof`
// files) because the signature and proof are binary. The key identifies this
// hand-over attempt so a retry cannot dispense twice.
export async function collectPrescription(
  prescriptionId: string,
  payload: CollectPayload,
  files: CollectFiles,
  idempotencyKey: string,
): Promise<CollectResult> {
  const form = new FormData();
  form.append("payload", new Blob([JSON.stringify(payload)], { type: "application/json" }));
  if (files.signature) form.append("signature", files.signature, "signature.png");
  if (files.proof) form.append("proof", files.proof);
  return apiClient.post<CollectResult>(`/api/v1/prescriptions/${prescriptionId}/collect`, form, {
    headers: { ...tenantAuthHeaders(), "Idempotency-Key": idempotencyKey },
  });
}

// Full third-party details. Reading them is audit-logged server-side, so the UI
// only asks when the pharmacist opens "View full details".
export interface CollectionDetails extends CollectionSummary {
  collectorIdType: CollectorIdType | null;
  collectorIdNumber: string | null;
  phone: string | null;
  authorisationType: AuthorisationType | null;
  idVerified: boolean;
  notes: string | null;
  proofUrl: string | null;
  signatureUrl: string | null;
}

export async function getCollectionDetails(prescriptionId: string): Promise<CollectionDetails> {
  return apiClient.get<CollectionDetails>(`/api/v1/prescriptions/${prescriptionId}/collection`, {
    headers: tenantAuthHeaders(),
  });
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

// Asks the prescriber to approve a substitute. Nothing is dispensed until they
// do. `message` is the (possibly edited) email text, so one request both emails
// the prescriber and records the REQUESTED status.
export async function requestSubstitution(
  prescriptionId: string,
  itemId: string,
  substituteProductId: string,
  message: string,
): Promise<void> {
  await apiClient.post<void>(
    `/api/v1/prescriptions/${prescriptionId}/items/${itemId}/substitution`,
    { substituteProductId, message },
    { headers: tenantAuthHeaders() },
  );
}
