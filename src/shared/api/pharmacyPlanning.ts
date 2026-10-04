import { pharmacyDelete, pharmacyGet, pharmacyPost, pharmacyPut, queryString } from "./pharmacyHttp";

// B2 of Docs/pharmacy-module-contract.md: reorder planning and opening stock.
// Endpoints marked ASSUMED are needed by the screens but not spelled out in
// the contract; the integrator should confirm them against the backend.

/* ------------------------------------------------------------------ */
/* Reorder                                                             */
/* ------------------------------------------------------------------ */

export type ReorderStatus = "IN_STOCK" | "LOW" | "OUT";

/** A supplier as the reorder sidebar needs it (the full supplier record lives in the receiving client). */
export interface ReorderSupplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  lastOrderedAt: string | null;
  /** Linked products that are low or out; drives the "N to order" badge. */
  toOrderCount: number;
}

export interface ReorderLine {
  productId: string;
  name: string;
  /** Strength / form, e.g. "500 mg tablet". */
  sub: string | null;
  baseUnit: string;
  packSize: number;
  onHand: number;
  reorderThreshold: number;
  targetQuantity: number;
  /** Already rounded up to whole packs; 0 when nothing is needed. */
  suggestedQuantity: number;
  status: ReorderStatus;
}

export interface ReorderSheet {
  supplier: ReorderSupplier;
  lines: ReorderLine[];
}

export interface PurchaseOrderLinePayload {
  productId: string;
  /** Units (not packs); the server also checks it is a whole number of packs. */
  quantity: number;
}

/** ASSUMED `POST /purchase-orders`: the contract has no PO endpoint but the screen prints a PO number. */
export interface CreatePurchaseOrderPayload {
  facilityId: string;
  supplierId: string;
  expectedDelivery?: string;
  lines: PurchaseOrderLinePayload[];
}

export interface PurchaseOrderLine {
  productId: string;
  name: string;
  sub: string | null;
  packSize: number;
  packs: number;
  quantity: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  facilityName: string;
  supplier: Pick<ReorderSupplier, "id" | "name" | "phone" | "email">;
  raisedByName: string;
  createdAt: string;
  expectedDelivery: string | null;
  lines: PurchaseOrderLine[];
  totalUnits: number;
}

/** ASSUMED `GET /suppliers?status=ACTIVE` extended with `lastOrderedAt` and `toOrderCount` for a facility. */
export async function listReorderSuppliers(facilityId: string): Promise<ReorderSupplier[]> {
  const response = await pharmacyGet<{ items: ReorderSupplier[] }>(
    `/suppliers?${queryString({ status: "ACTIVE", facilityId, size: "100" })}`,
  );
  return response.items;
}

export function getReorderSheet(facilityId: string, supplierId: string): Promise<ReorderSheet> {
  return pharmacyGet(`/reorder?${queryString({ facilityId, supplierId })}`);
}

export function linkProductToSupplier(supplierId: string, productId: string): Promise<void> {
  return pharmacyPut(`/suppliers/${supplierId}/products/${productId}`);
}

export function unlinkProductFromSupplier(supplierId: string, productId: string): Promise<void> {
  return pharmacyDelete(`/suppliers/${supplierId}/products/${productId}`);
}

export function createPurchaseOrder(payload: CreatePurchaseOrderPayload, idempotencyKey: string): Promise<PurchaseOrder> {
  return pharmacyPost("/purchase-orders", payload, idempotencyKey);
}

/* ------------------------------------------------------------------ */
/* Opening stock                                                       */
/* ------------------------------------------------------------------ */

export type OpeningRowStatus = "OK" | "UNKNOWN_PRODUCT" | "BAD_EXPIRY" | "DUPLICATE_LOT" | "BAD_QUANTITY";

/** One row exactly as typed; `quantity` stays text so "three80" can be caught and shown. */
export interface OpeningStockRow {
  sku: string;
  lot: string;
  expiry: string;
  quantity: string;
}

export interface OpeningRowResult {
  status: OpeningRowStatus;
  /** Plain-language fix, written by the server. */
  hint: string | null;
  product: { id: string; name: string; sub: string | null } | null;
}

export interface ValidateOpeningStockPayload {
  facilityId: string;
  rows: OpeningStockRow[];
}

export interface ValidateOpeningStockResponse {
  /** Same order and length as the rows sent. */
  results: OpeningRowResult[];
}

export interface PostOpeningStockResult {
  lotCount: number;
  totalUnits: number;
  postedAt: string;
}

export function validateOpeningStock(payload: ValidateOpeningStockPayload): Promise<ValidateOpeningStockResponse> {
  return pharmacyPost("/opening-stock/validate", payload);
}

/** 409 when the facility already has an opening balance; safe to retry with the same key. */
export function postOpeningStock(payload: ValidateOpeningStockPayload, idempotencyKey: string): Promise<PostOpeningStockResult> {
  return pharmacyPost("/opening-stock", payload, idempotencyKey);
}
