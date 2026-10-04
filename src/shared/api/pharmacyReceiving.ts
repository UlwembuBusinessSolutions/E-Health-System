import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

// Suppliers and goods-received receipts (Docs/pharmacy-module-contract.md,
// section 3 "B2"). Every request and response type for this slice lives here
// so the integrator can reconcile it with the real backend in one place.
// Receipt list/detail types belong to the ledger screens, not to this file.

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
  /** Set on a supplier that was archived by a merge. */
  mergedIntoId: string | null;
  mergedIntoName: string | null;
  /** Roll-ups for the list screen; the backend may omit them on lean responses. */
  productCount?: number;
  receiptCount?: number;
  lastReceivedAt?: string | null;
}

export interface ListSuppliersParams {
  q?: string;
  status?: SupplierStatus;
}

// Suppliers are a short list per facility group, so the screen loads them in
// one request and filters further client-side where it can.
const SUPPLIER_PAGE_SIZE = 200;

export async function listSuppliers(params: ListSuppliersParams = {}): Promise<Supplier[]> {
  const search = new URLSearchParams({ size: String(SUPPLIER_PAGE_SIZE) });
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  const response = await apiClient.get<{ items: Supplier[] }>(`${BASE}/suppliers?${search.toString()}`, {
    headers: tenantAuthHeaders(),
  });
  return response.items;
}

export interface SupplierPayload {
  name: string;
  phone?: string;
  email?: string;
  /** Set once the user has seen a "looks similar" warning and chose to add the supplier anyway. */
  confirmDistinct?: boolean;
}

/**
 * A name collision comes back as 409 `{ code: "DUPLICATE_SUPPLIER", existing, similar }`
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

/** Re-points every receipt of `sourceId` to `intoSupplierId`, then archives the source. */
export function mergeSuppliers(sourceId: string, intoSupplierId: string): Promise<Supplier> {
  return apiClient.post<Supplier>(`${BASE}/suppliers/${sourceId}/merge`, { intoSupplierId }, {
    headers: tenantAuthHeaders(),
  });
}

export interface SupplierReceiptSummary {
  id: string;
  receiptNumber: string;
  invoiceNumber: string | null;
  receivedAt: string;
  totalUnits: number;
}

export async function listSupplierReceipts(supplierId: string): Promise<SupplierReceiptSummary[]> {
  const response = await apiClient.get<{ items: SupplierReceiptSummary[] }>(
    `${BASE}/suppliers/${supplierId}/receipts`,
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}

// ---------------------------------------------------------------------------
// Receiving
// ---------------------------------------------------------------------------

export type ReceiptFlagReason = "DAMAGED" | "SHORT" | "WRONG_ITEM" | "NEAR_EXPIRY";

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

// One idempotency key per submit ATTEMPT (same rule as the Phase 1 receiveStock):
// the caller reuses it when retrying the same attempt so a double-click or a
// network retry can never post the receipt twice.
export function postReceipt(payload: PostReceiptPayload, idempotencyKey: string): Promise<PostedReceipt> {
  return apiClient.post<PostedReceipt>(`${BASE}/receipts`, payload, {
    headers: { ...tenantAuthHeaders(), "Idempotency-Key": idempotencyKey },
  });
}

/**
 * Tracking flags added by the Phase 2 contract. `PharmacyProduct` (pharmacyStock.ts,
 * owned by the products agent) gains them too; they are optional here so this
 * screen type-checks either way and treats a missing flag as "not tracked".
 */
export interface ProductTrackingFlags {
  serialTracked?: boolean;
  coldChain?: boolean;
}
