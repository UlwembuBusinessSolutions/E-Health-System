import type { PagedResult } from "./pharmacyStock";
import { pharmacyGet as get, pharmacyPost, pharmacyPut, queryString as query } from "./pharmacyHttp";

// B4 of Docs/pharmacy-module-contract.md: stock counts and the scheduled
// medicines register, typed to agent B4's actual response shapes. Endpoints
// marked ASSUMED are needed by the screens but not part of B4's list; the
// integrator should confirm them (they are all gathered here on purpose).

/* ------------------------------------------------------------------ */
/* Stock counts                                                        */
/* ------------------------------------------------------------------ */

export type CountScope = "ALL" | "AREA" | "PRODUCT";
export type CountStatus = "DRAFT" | "POSTED" | "CANCELLED";

/** Why a counted lot differs from the ledger (what the pharmacist picks in review). */
export type CountReason =
  | "MISCOUNT"
  | "DAMAGED"
  | "EXPIRED_REMOVED"
  | "LOST_OR_MISSING"
  | "UNRECORDED_RECEIPT"
  | "RETURNED_TO_STOCK";

export interface CountSummary {
  id: string;
  facilityId: string;
  scope: CountScope;
  /** Human wording of the scope, e.g. "Whole facility" or "Shelf A". */
  scopeLabel: string;
  blind: boolean;
  status: CountStatus;
  reference: string;
  startedByName: string;
  startedAt: string;
  postedByName: string | null;
  postedAt: string | null;
  totalLots: number;
  lotsCounted: number;
  /** `null` while a blind count is still a draft. */
  matches: number | null;
  differences: number | null;
}

export interface CountLine {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  lotNumber: string;
  expiryDate: string | null;
  /** A lot found on the shelf that the ledger did not know about. */
  foundInCount: boolean;
  countedQuantity: number | null;
  /** System quantity when the line was counted; `baselineQuantity`, `expectedQuantity`, `variance` and `large` are null while a blind count is a draft. */
  baselineQuantity: number | null;
  expectedQuantity: number | null;
  variance: number | null;
  large: boolean | null;
  reason: CountReason | null;
  countedAt: string | null;
}

export interface CountDetail extends CountSummary {
  lines: CountLine[];
}

export interface StartCountPayload {
  facilityId: string;
  scope: CountScope;
  areaLabel?: string;
  productQuery?: string;
  blind: boolean;
}

export interface FoundLotPayload {
  productId: string;
  lotNumber: string;
  /** Full calendar day, YYYY-MM-DD. */
  expiryDate: string;
  quantity: number;
}

/** ASSUMED `GET /counts/setup`: what the scope cards on the set-up step need. */
export interface CountSetupInfo {
  areas: { label: string; lotCount: number }[];
  wholeFacilityLotCount: number;
  lastCountedAt: string | null;
}

export function getCountSetup(facilityId: string): Promise<CountSetupInfo> {
  return get(`/counts/setup?${query({ facilityId })}`);
}

export function listCounts(facilityId: string, status: CountStatus): Promise<PagedResult<CountSummary>> {
  return get(`/counts?${query({ facilityId, status, size: "50" })}`);
}

export function startCount(payload: StartCountPayload): Promise<CountDetail> {
  return pharmacyPost("/counts", payload);
}

/**
 * `revealSystem` is ASSUMED: B4 hides the system figures for every blind
 * draft, but the review step must show them. The count step never passes it;
 * the review step does, once the person has finished counting.
 */
export function getCount(countId: string, revealSystem = false): Promise<CountDetail> {
  return get(`/counts/${countId}${revealSystem ? "?revealSystem=true" : ""}`);
}

/** The server stamps the line's baseline with the system quantity at this moment. */
export function setCountedQuantity(countId: string, lineId: string, countedQuantity: number): Promise<CountLine> {
  return pharmacyPut(`/counts/${countId}/lines/${lineId}`, { countedQuantity });
}

export function addFoundLot(countId: string, payload: FoundLotPayload): Promise<CountLine> {
  return pharmacyPost(`/counts/${countId}/found-lots`, payload);
}

export function setLineReason(countId: string, lineId: string, reason: CountReason): Promise<CountLine> {
  return pharmacyPut(`/counts/${countId}/lines/${lineId}/reason`, { reason });
}

/** Idempotent. The posted lines are read afterwards with `getCount`. */
export function postCount(countId: string, idempotencyKey: string): Promise<CountSummary> {
  return pharmacyPost(`/counts/${countId}/post`, undefined, idempotencyKey);
}

export function cancelCount(countId: string): Promise<void> {
  return pharmacyPost(`/counts/${countId}/cancel`);
}

/* ------------------------------------------------------------------ */
/* Scheduled medicines register                                        */
/* ------------------------------------------------------------------ */

export type ScheduleLevel = "S5" | "S6";
export type RegisterEntryKind = "DISPENSED" | "RECEIVED" | "DESTROYED" | "LOST" | "RETURNED" | "OPENING";
/** The kinds a person can record by hand; the rest are written by dispensing and receiving. */
export type ManualRemovalKind = Extract<RegisterEntryKind, "DISPENSED" | "DESTROYED" | "LOST" | "RETURNED">;

/** ASSUMED `GET /schedule-register/products`: the picker cards with live balances. */
export interface ScheduledProduct {
  productId: string;
  name: string;
  sub: string | null;
  schedule: ScheduleLevel;
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
  ledgerTransactionId: string | null;
}

export interface RegisterPage extends PagedResult<RegisterEntry> {
  currentBalance: number;
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
  /** Not in B4's body yet: sent for destroyed / lost / returned so the integrator can wire it up. */
  reason?: string;
  lotNumber: string;
  witnessStaffId?: string;
  /** The witness's own account password. */
  witnessPin?: string;
}

/** ASSUMED `GET /schedule-register/witnesses`: colleagues who may witness (never the caller). */
export interface WitnessCandidate {
  id: string;
  name: string;
  roleLabel: string | null;
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

export function listScheduledProducts(facilityId: string): Promise<ScheduledProduct[]> {
  return get<{ items: ScheduledProduct[] }>(`/schedule-register/products?${query({ facilityId })}`).then(
    (response) => response.items,
  );
}

export function getRegisterPage(facilityId: string, productId: string, page: number, size: number): Promise<RegisterPage> {
  return get(`/schedule-register?${query({ facilityId, productId, page: String(page), size: String(size) })}`);
}

export function recordRegisterEntry(payload: RecordRegisterEntryPayload, idempotencyKey: string): Promise<RegisterEntry> {
  return pharmacyPost("/schedule-register/entries", payload, idempotencyKey);
}

export function listWitnessCandidates(facilityId: string): Promise<WitnessCandidate[]> {
  return get<{ items: WitnessCandidate[] }>(`/schedule-register/witnesses?${query({ facilityId })}`).then(
    (response) => response.items,
  );
}

export function getDayClose(facilityId: string, productId: string, date: string): Promise<DayClose> {
  return get(`/schedule-register/day-close?${query({ facilityId, productId, date })}`);
}

export function closeDay(payload: CloseDayPayload): Promise<DayClose> {
  return pharmacyPost("/schedule-register/day-close", payload);
}
