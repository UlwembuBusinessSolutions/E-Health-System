import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";
import { queryString } from "./queryString";

// Stock counts, backed by co.ehealth.platform.pharmacy.count. The scheduled
// medicines register has its own client in pharmacyRegister.ts.

const BASE = "/api/v1/pharmacy/counts";

export type CountScope = "ALL" | "AREA" | "PRODUCT";
export type CountStatus = "DRAFT" | "POSTED" | "CANCELLED";

/** Why a counted lot differs from the ledger (what the pharmacist picks in review). The server stores it as free text. */
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
  /** `baselineQuantity`, `expectedQuantity`, `variance` and `large` are null while a blind count is a draft. */
  baselineQuantity: number | null;
  expectedQuantity: number | null;
  variance: number | null;
  large: boolean | null;
  reason: string | null;
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

/** What the scope cards on the set-up step need. */
export interface CountSetupInfo {
  wholeFacilityLots: number;
  areas: { label: string; lotCount: number; lastCountedAt: string | null }[];
}

export function getCountSetup(facilityId: string): Promise<CountSetupInfo> {
  return apiClient.get<CountSetupInfo>(`${BASE}/setup?${queryString({ facilityId })}`, {
    headers: tenantAuthHeaders(),
  });
}

// The list is not paged: it is the facility's counts in one array, newest first.
export function listCounts(facilityId: string, status: CountStatus): Promise<CountSummary[]> {
  return apiClient.get<CountSummary[]>(`${BASE}?${queryString({ facilityId, status })}`, {
    headers: tenantAuthHeaders(),
  });
}

export function startCount(payload: StartCountPayload): Promise<CountDetail> {
  return apiClient.post<CountDetail>(BASE, payload, { headers: tenantAuthHeaders() });
}

/**
 * A blind draft hides the system figures. The count step reads it as is; the
 * review step passes `revealSystem` once the person has finished counting.
 */
export function getCount(countId: string, revealSystem = false): Promise<CountDetail> {
  return apiClient.get<CountDetail>(`${BASE}/${countId}?${queryString({ revealSystem: revealSystem || undefined })}`, {
    headers: tenantAuthHeaders(),
  });
}

/** The server stamps the line's baseline with the system quantity at this moment. */
export function setCountedQuantity(countId: string, lineId: string, countedQuantity: number): Promise<CountLine> {
  return apiClient.put<CountLine>(`${BASE}/${countId}/lines/${lineId}`, { countedQuantity }, {
    headers: tenantAuthHeaders(),
  });
}

export function addFoundLot(countId: string, payload: FoundLotPayload): Promise<CountLine> {
  return apiClient.post<CountLine>(`${BASE}/${countId}/found-lots`, payload, { headers: tenantAuthHeaders() });
}

export function setLineReason(countId: string, lineId: string, reason: CountReason): Promise<CountLine> {
  return apiClient.put<CountLine>(`${BASE}/${countId}/lines/${lineId}/reason`, { reason }, {
    headers: tenantAuthHeaders(),
  });
}

// Posting a count that is already posted returns it untouched, so a retry is
// safe without an idempotency key.
export function postCount(countId: string): Promise<CountDetail> {
  return apiClient.post<CountDetail>(`${BASE}/${countId}/post`, undefined, { headers: tenantAuthHeaders() });
}

export function cancelCount(countId: string): Promise<CountDetail> {
  return apiClient.post<CountDetail>(`${BASE}/${countId}/cancel`, undefined, { headers: tenantAuthHeaders() });
}
