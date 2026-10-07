import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";
import { queryString } from "./queryString";
import type { PagedResult } from "./types";
import type { Supplier, SupplierOrderInfo } from "./pharmacyReceiving";

// Reorder planning, purchase orders and opening stock, backed by
// co.ehealth.platform.pharmacy.reorder and .openingstock.

const BASE = "/api/v1/pharmacy";

/* ------------------------------------------------------------------ */
/* Reorder                                                             */
/* ------------------------------------------------------------------ */

/** OK means comfortably stocked (or no reorder level set), LOW is at or under the level, OUT is empty. */
export type ReorderStatus = "OUT" | "LOW" | "OK";

/** A supplier with the reorder picture for one facility. */
export type ReorderSupplier = Supplier & SupplierOrderInfo;

export interface ReorderLine {
  productId: string;
  name: string;
  /** Strength and form, e.g. "500 mg tablet"; empty when neither is on file. */
  sub: string;
  /** Null when the product is not sold in packs. */
  packSize: number | null;
  onHand: number;
  reorderThreshold: number | null;
  targetQuantity: number | null;
  /** Already rounded up to whole packs; 0 when nothing is needed. */
  suggestedQuantity: number;
  status: ReorderStatus;
}

export interface ReorderSheet {
  supplier: Pick<Supplier, "id" | "name">;
  lines: ReorderLine[];
}

// Suppliers are a short list per facility group, and the server caps a page at 100.
const SUPPLIER_PAGE_SIZE = 100;

/** Active suppliers with `toOrderCount` and `lastOrderedAt` for the facility. */
export async function listReorderSuppliers(facilityId: string): Promise<ReorderSupplier[]> {
  const response = await apiClient.get<PagedResult<ReorderSupplier>>(
    `${BASE}/suppliers?${queryString({ status: "ACTIVE", facilityId, size: SUPPLIER_PAGE_SIZE })}`,
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}

export function getReorderSheet(facilityId: string, supplierId: string): Promise<ReorderSheet> {
  return apiClient.get<ReorderSheet>(`${BASE}/reorder?${queryString({ facilityId, supplierId })}`, {
    headers: tenantAuthHeaders(),
  });
}

export function linkProductToSupplier(supplierId: string, productId: string): Promise<void> {
  return apiClient.put<void>(`${BASE}/suppliers/${supplierId}/products/${productId}`, undefined, {
    headers: tenantAuthHeaders(),
  });
}

export function unlinkProductFromSupplier(supplierId: string, productId: string): Promise<void> {
  return apiClient.delete<void>(`${BASE}/suppliers/${supplierId}/products/${productId}`, {
    headers: tenantAuthHeaders(),
  });
}

export interface PurchaseOrderLinePayload {
  productId: string;
  packs: number;
  packSize: number;
  /** Units, i.e. `packs * packSize`. */
  quantity: number;
}

export interface CreatePurchaseOrderPayload {
  facilityId: string;
  supplierId: string;
  /** `YYYY-MM-DD`. */
  expectedDelivery?: string;
  lines: PurchaseOrderLinePayload[];
}

export interface PurchaseOrderLine {
  productId: string;
  productName: string;
  packs: number;
  packSize: number;
  quantity: number;
}

export interface PurchaseOrder {
  id: string;
  /** The server's number for the order, quoted on the supplier's invoice. */
  poNumber: string;
  supplierId: string;
  supplierName: string;
  createdAt: string;
  expectedDelivery: string | null;
  createdByName: string;
  totalUnits: number;
  lines: PurchaseOrderLine[];
}

export function createPurchaseOrder(payload: CreatePurchaseOrderPayload): Promise<PurchaseOrder> {
  return apiClient.post<PurchaseOrder>(`${BASE}/purchase-orders`, payload, { headers: tenantAuthHeaders() });
}

/* ------------------------------------------------------------------ */
/* Opening stock                                                       */
/* ------------------------------------------------------------------ */

export type OpeningRowStatus =
  | "OK"
  | "UNKNOWN_PRODUCT"
  | "BAD_EXPIRY"
  | "DUPLICATE_LOT"
  | "BAD_QUANTITY"
  /** Serial-tracked products need a serial per unit, so they go through Receive stock instead. */
  | "SERIAL_PRODUCT";

/** One row exactly as typed; `quantity` stays text so "three80" can be caught and shown. */
export interface OpeningStockRow {
  sku: string;
  lot: string;
  expiry: string;
  quantity: string;
}

export interface OpeningRowResult {
  /** 1-based position of the row in the request. */
  rowNumber: number;
  status: OpeningRowStatus;
  /** Plain-language fix, written by the server. */
  hint: string | null;
  product: { id: string; code: string; name: string } | null;
}

export interface OpeningStockPayload {
  facilityId: string;
  rows: OpeningStockRow[];
}

export interface ValidateOpeningStockResponse {
  /** Same order and length as the rows sent. */
  rows: OpeningRowResult[];
  allOk: boolean;
}

export interface PostOpeningStockResult {
  transactionId: string;
  rowsLoaded: number;
  totalUnits: number;
}

export function validateOpeningStock(payload: OpeningStockPayload): Promise<ValidateOpeningStockResponse> {
  return apiClient.post<ValidateOpeningStockResponse>(`${BASE}/opening-stock/validate`, payload, {
    headers: tenantAuthHeaders(),
  });
}

// No idempotency key: a facility can only ever load its opening balance once,
// so a repeated request answers 409 instead of loading twice.
export function postOpeningStock(payload: OpeningStockPayload): Promise<PostOpeningStockResult> {
  return apiClient.post<PostOpeningStockResult>(`${BASE}/opening-stock`, payload, { headers: tenantAuthHeaders() });
}
