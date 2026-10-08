import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";
import { queryString } from "./queryString";
import type { PagedResult } from "./types";
import type { DrugSchedule } from "./pharmacyStock";

// The scheduled (S5/S6) medicines register, backed by
// co.ehealth.platform.pharmacy.register.

const BASE = "/api/v1/pharmacy/schedule-register";

export type RegisterEntryKind = "DISPENSED" | "RECEIVED" | "DESTROYED" | "LOST" | "RETURNED" | "OPENING" | "REVERSED";
/** The kinds a person can record by hand; the rest are written by dispensing and receiving. */
export type ManualRemovalKind = Extract<RegisterEntryKind, "DISPENSED" | "DESTROYED" | "LOST" | "RETURNED">;

/** A scheduled product with its live register balance, for the product picker. */
export interface ScheduledProduct {
  productId: string;
  productName: string;
  productCode: string;
  schedule: DrugSchedule;
  onHand: number;
  currentLot: string | null;
}

export interface RegisterEntry {
  id: string;
  facilityId: string;
  productId: string;
  productName: string;
  productCode: string;
  entryAt: string;
  kind: RegisterEntryKind;
  rxSerial: string | null;
  patientName: string | null;
  patientIdRef: string | null;
  prescriberName: string | null;
  prescriberRegNo: string | null;
  quantityIn: number;
  quantityOut: number;
  balanceAfter: number;
  lotNumber: string;
  dispensedByName: string;
  witnessedByName: string | null;
  /** Why stock was destroyed or lost. */
  reason: string | null;
  ledgerTransactionId: string | null;
}

export interface RegisterPage extends PagedResult<RegisterEntry> {
  /** Null when the listing spans several products. */
  currentBalance: number | null;
}

export interface RecordRegisterEntryPayload {
  facilityId: string;
  productId: string;
  kind: ManualRemovalKind;
  quantity: number;
  rxSerial?: string;
  patientName?: string;
  patientIdRef?: string;
  prescriber?: string;
  prescriberRegNo?: string;
  /** Required (at least 3 characters) for DESTROYED and LOST. */
  reason?: string;
  lotNumber: string;
  witnessStaffId?: string;
  /** The witness's own account password. */
  witnessPin?: string;
}

/** A colleague who may witness a Schedule 6 movement (never the caller). */
export interface WitnessCandidate {
  id: string;
  name: string;
}

export interface DayClose {
  facilityId: string;
  productId: string;
  date: string;
  opening: number;
  received: number;
  dispensed: number;
  destroyed: number;
  lost: number;
  returned: number;
  /** The server's own figure; the card recomputes it from the parts so the sum always adds up on screen. */
  expected: number;
  closed: boolean;
  counted: number | null;
  variance: number | null;
  varianceReason: string | null;
  closedByName: string | null;
  closedAt: string | null;
}

export interface CloseDayPayload {
  facilityId: string;
  productId: string;
  date: string;
  countedQuantity: number;
  varianceReason?: string;
}

export async function listScheduledProducts(facilityId: string): Promise<ScheduledProduct[]> {
  const response = await apiClient.get<{ items: ScheduledProduct[] }>(
    `${BASE}/products?${queryString({ facilityId })}`,
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}

export function getRegisterPage(facilityId: string, productId: string, page: number, size: number): Promise<RegisterPage> {
  return apiClient.get<RegisterPage>(`${BASE}?${queryString({ facilityId, productId, page, size })}`, {
    headers: tenantAuthHeaders(),
  });
}

// No idempotency key: the server does not read one on register entries.
export function recordRegisterEntry(payload: RecordRegisterEntryPayload): Promise<RegisterEntry> {
  return apiClient.post<RegisterEntry>(`${BASE}/entries`, payload, { headers: tenantAuthHeaders() });
}

export async function listWitnessCandidates(facilityId: string): Promise<WitnessCandidate[]> {
  const response = await apiClient.get<{ items: WitnessCandidate[] }>(
    `${BASE}/witnesses?${queryString({ facilityId })}`,
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}

export function getDayClose(facilityId: string, productId: string, date: string): Promise<DayClose> {
  return apiClient.get<DayClose>(`${BASE}/day-close?${queryString({ facilityId, productId, date })}`, {
    headers: tenantAuthHeaders(),
  });
}

export function closeDay(payload: CloseDayPayload): Promise<DayClose> {
  return apiClient.post<DayClose>(`${BASE}/day-close`, payload, { headers: tenantAuthHeaders() });
}
