import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";
import { queryString } from "./queryString";
import type { PagedResult } from "./types";
import type { ReceiptFlagReason, ReceiptSummary } from "./pharmacyLedger";

// Suppliers and goods-received receipts, backed by
// co.ehealth.platform.pharmacy.supplier and .stock (POST /receipts). Reading
// receipts back is in pharmacyLedger.ts.

const BASE = "/api/v1/pharmacy";

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

export type SupplierStatus = "ACTIVE" | "ARCHIVED";

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: SupplierStatus;
  /** Set on a supplier that was archived by a merge: the supplier it was merged into. */
  mergedIntoId: string | null;
  /** Products linked to this supplier for reordering. */
  productCount: number;
  createdAt: string;
}

/** What `GET /suppliers?facilityId=` adds: the reorder picture at that facility. */
export interface SupplierOrderInfo {
  /** Linked products that are low or out at the facility. */
  toOrderCount: number;
  lastOrderedAt: string | null;
}

export interface ListSuppliersParams {
  q?: string;
  status?: SupplierStatus;
}

// The server caps a page at 100 suppliers. That is plenty for one pharmacy
// group, so the screens load them in one request and filter client-side.
const SUPPLIER_PAGE_SIZE = 100;

export async function listSuppliers(params: ListSuppliersParams = {}): Promise<Supplier[]> {
  const response = await apiClient.get<PagedResult<Supplier>>(
    `${BASE}/suppliers?${queryString({ ...params, size: SUPPLIER_PAGE_SIZE })}`,
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}

/** Id and name of every active supplier, for the "usual supplier" and receipt-filter pickers. */
export async function listSupplierOptions(): Promise<Pick<Supplier, "id" | "name">[]> {
  return listSuppliers({ status: "ACTIVE" });
}

export interface SupplierPayload {
  name: string;
  phone?: string;
  email?: string;
  /** Set once the user has seen a "looks similar" warning and chose to add the supplier anyway. */
  confirmDistinct?: boolean;
}

/**
 * A name collision comes back as 409 `{ code: "DUPLICATE_SUPPLIER", message, existing: {id, name}, similar }`
 * and surfaces on `ApiError.code / .existing / .similar` (see client.ts).
 */
export const DUPLICATE_SUPPLIER_CODE = "DUPLICATE_SUPPLIER";

export function createSupplier(payload: SupplierPayload): Promise<Supplier> {
  return apiClient.post<Supplier>(`${BASE}/suppliers`, payload, { headers: tenantAuthHeaders() });
}

export function updateSupplier(id: string, payload: SupplierPayload): Promise<Supplier> {
  return apiClient.patch<Supplier>(`${BASE}/suppliers/${id}`, payload, { headers: tenantAuthHeaders() });
}

export function archiveSupplier(id: string): Promise<Supplier> {
  return apiClient.post<Supplier>(`${BASE}/suppliers/${id}/archive`, undefined, { headers: tenantAuthHeaders() });
}

export function reactivateSupplier(id: string): Promise<Supplier> {
  return apiClient.post<Supplier>(`${BASE}/suppliers/${id}/reactivate`, undefined, { headers: tenantAuthHeaders() });
}

/** Re-points every receipt of `sourceId` to `intoSupplierId`, archives the source, and returns the surviving supplier. */
export function mergeSuppliers(sourceId: string, intoSupplierId: string): Promise<Supplier> {
  return apiClient.post<Supplier>(`${BASE}/suppliers/${sourceId}/merge`, { intoSupplierId }, {
    headers: tenantAuthHeaders(),
  });
}

/** A supplier's latest receipts, newest first. */
export async function listSupplierReceipts(supplierId: string): Promise<ReceiptSummary[]> {
  const response = await apiClient.get<PagedResult<ReceiptSummary>>(`${BASE}/suppliers/${supplierId}/receipts`, {
    headers: tenantAuthHeaders(),
  });
  return response.items;
}

// ---------------------------------------------------------------------------
// Receiving
// ---------------------------------------------------------------------------

export interface ReceiptLineFlag {
  reason: ReceiptFlagReason;
  note: string;
  /** Units that go on the shelf; `received - accepted` is rejected and never stocked. */
  acceptedQuantity: number;
}

export interface PostReceiptLine {
  productId: string;
  lotNumber?: string;
  /** Always a full calendar day (`YYYY-MM-DD`). Required for expiry-tracked products. */
  expiryDate?: string;
  expiryPrecision?: "DAY";
  packs?: number;
  packSizeUsed?: number;
  /** Units that ARRIVED. Accepted units are `flag.acceptedQuantity` when flagged, else this. */
  baseQuantity: number;
  /** One per unit for serial-tracked products; the first `acceptedQuantity` are stocked. */
  serialNumbers?: string[];
  temperatureC?: number;
  coldBoxIntact?: boolean;
  flag?: ReceiptLineFlag;
}

export interface PostReceiptPayload {
  facilityId: string;
  supplierId: string;
  invoiceNumber?: string;
  lines: PostReceiptLine[];
}

export interface PostedReceipt {
  id: string;
  receiptNumber: string;
}

// One idempotency key per submit ATTEMPT: the caller reuses it when retrying
// the same attempt so a double-click or a network retry can never post the
// receipt twice (PharmacyStockLedgerService's own why-note on why the key has
// to come from the caller, not be derived from body content).
export function postReceipt(payload: PostReceiptPayload, idempotencyKey: string): Promise<PostedReceipt> {
  return apiClient.post<PostedReceipt>(`${BASE}/receipts`, payload, {
    headers: { ...tenantAuthHeaders(), "Idempotency-Key": idempotencyKey },
  });
}
