import { apiClient, apiOrigin, ApiError } from "./client";
import { tenantAuthHeaders } from "./auth";

// Phase 1 of Docs/pharmacy-stock-ledger-plan.md — product catalog, batches
// and receiving, backed by co.ehealth.platform.pharmacy.stock. Deliberately
// separate from pharmacy.ts (the existing prescription/dispensing client):
// that module has no stock/batch concept yet (Phase 3 wires the two
// together), and this file exists independently of it until then.

export type StockCategory = "MEDICINE" | "SUPPLY";
export type StockBaseUnit = "TABLET" | "CAPSULE" | "BOTTLE" | "VIAL" | "SEALED_PACK" | "EACH";
export type ExpiryPrecision = "DAY" | "MONTH";

export interface PharmacyProduct {
  id: string;
  code: string;
  displayName: string;
  genericName: string | null;
  strength: string | null;
  dosageForm: string | null;
  category: StockCategory;
  baseUnit: StockBaseUnit;
  packSize: number | null;
  barcode: string | null;
  manufacturer: string | null;
  batchTracked: boolean;
  expiryTracked: boolean;
  storageInstructions: string | null;
  active: boolean;
  createdByName: string;
  createdAt: string;
  updatedByName: string | null;
  updatedAt: string | null;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  hasMore: boolean;
}

export interface ListProductsParams {
  q?: string;
  activeOnly?: boolean;
  page?: number;
  size?: number;
}

export async function listProducts(params: ListProductsParams = {}): Promise<PagedResult<PharmacyProduct>> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.activeOnly !== undefined) search.set("activeOnly", String(params.activeOnly));
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.size !== undefined) search.set("size", String(params.size));
  return apiClient.get<PagedResult<PharmacyProduct>>(`/api/v1/pharmacy/products?${search.toString()}`, {
    headers: tenantAuthHeaders(),
  });
}

export async function getProduct(id: string): Promise<PharmacyProduct> {
  return apiClient.get<PharmacyProduct>(`/api/v1/pharmacy/products/${id}`, { headers: tenantAuthHeaders() });
}

export interface CreateProductPayload {
  code: string;
  displayName: string;
  genericName?: string;
  strength?: string;
  dosageForm?: string;
  category: StockCategory;
  baseUnit: StockBaseUnit;
  packSize?: number;
  barcode?: string;
  manufacturer?: string;
  batchTracked: boolean;
  expiryTracked: boolean;
  storageInstructions?: string;
  facilityId: string;
  reorderThreshold?: number;
  targetQuantity?: number;
}

export async function createProduct(payload: CreateProductPayload): Promise<PharmacyProduct> {
  return apiClient.post<PharmacyProduct>("/api/v1/pharmacy/products", payload, { headers: tenantAuthHeaders() });
}

export interface UpdateProductPayload {
  displayName: string;
  genericName?: string;
  strength?: string;
  dosageForm?: string;
  packSize?: number;
  barcode?: string;
  manufacturer?: string;
  storageInstructions?: string;
}

export async function updateProduct(id: string, payload: UpdateProductPayload): Promise<PharmacyProduct> {
  return apiClient.patch<PharmacyProduct>(`/api/v1/pharmacy/products/${id}`, payload, {
    headers: tenantAuthHeaders(),
  });
}

export async function archiveProduct(id: string): Promise<PharmacyProduct> {
  return apiClient.post<PharmacyProduct>(`/api/v1/pharmacy/products/${id}/archive`, undefined, {
    headers: tenantAuthHeaders(),
  });
}

export async function reactivateProduct(id: string): Promise<PharmacyProduct> {
  return apiClient.post<PharmacyProduct>(`/api/v1/pharmacy/products/${id}/reactivate`, undefined, {
    headers: tenantAuthHeaders(),
  });
}

export type StockStatus = "In stock" | "Low stock" | "Out of stock";

export interface StockRow {
  productId: string;
  code: string;
  displayName: string;
  baseUnit: StockBaseUnit;
  available: number;
  reorderThreshold: number | null;
  status: StockStatus;
}

export async function listStock(facilityId: string): Promise<StockRow[]> {
  const response = await apiClient.get<{ items: StockRow[] }>(
    `/api/v1/pharmacy/stock?facilityId=${encodeURIComponent(facilityId)}`,
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}

export interface BatchRow {
  batchId: string;
  lotNumber: string;
  manufacturer: string | null;
  expiryDate: string | null;
  expiryPrecision: ExpiryPrecision | null;
  quantity: number;
}

export async function listBatches(productId: string): Promise<BatchRow[]> {
  const response = await apiClient.get<{ items: BatchRow[] }>(`/api/v1/pharmacy/products/${productId}/batches`, {
    headers: tenantAuthHeaders(),
  });
  return response.items;
}

export interface LedgerEntry {
  id: string;
  seq: number;
  type: string;
  productName: string;
  productCode: string;
  lotNumber: string | null;
  quantityDelta: number;
  balanceAfter: number;
  actorName: string;
  reason: string | null;
  sourceReference: string | null;
  createdAt: string;
}

export interface ListLedgerParams {
  facilityId: string;
  productId?: string;
  page?: number;
  size?: number;
}

export async function listLedger(params: ListLedgerParams): Promise<PagedResult<LedgerEntry>> {
  const search = new URLSearchParams({ facilityId: params.facilityId });
  if (params.productId) search.set("productId", params.productId);
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.size !== undefined) search.set("size", String(params.size));
  return apiClient.get<PagedResult<LedgerEntry>>(`/api/v1/pharmacy/ledger?${search.toString()}`, {
    headers: tenantAuthHeaders(),
  });
}

export interface ReceiveLinePayload {
  productId: string;
  manufacturer?: string;
  lotNumber?: string;
  expiryDate?: string;
  expiryPrecision?: ExpiryPrecision;
  packs?: number;
  packSizeUsed?: number;
  baseQuantity: number;
}

export interface ReceiveStockPayload {
  facilityId: string;
  sourceReference?: string;
  supplierName?: string;
  lines: ReceiveLinePayload[];
}

export interface ReceiptResult {
  id: string;
  facilityId: string;
  sourceReference: string | null;
  supplierName: string | null;
  createdByName: string;
  createdAt: string;
}

// A fresh idempotency key per submit ATTEMPT, not per body — the same key
// is reused only when retrying this exact attempt (e.g. after a network
// error), never regenerated on every render, so a genuine double-click or
// a browser retry of the same POST can't double-post the receipt
// (PharmacyStockLedgerService's own why-note on why the key has to come
// from the caller, not be derived purely from body content).
export async function receiveStock(payload: ReceiveStockPayload, idempotencyKey: string): Promise<ReceiptResult> {
  return apiClient.post<ReceiptResult>("/api/v1/pharmacy/receipts", payload, {
    headers: { ...tenantAuthHeaders(), "Idempotency-Key": idempotencyKey },
  });
}

// apiOrigin() prefix is required, not cosmetic — found by real browser
// testing: a bare relative path only resolves correctly when the frontend
// and backend share an origin. In this dev setup (5173 vs 8081) it
// silently hit Vite's own SPA fallback instead of the API — a 200
// response with index.html's HTML, not a CSV — which apiClient's own
// internal request() already avoids by prefixing every call with
// API_BASE_URL; this bypasses apiClient (CSV isn't JSON) and has to repeat
// that same prefixing itself.
async function downloadCsv(path: string): Promise<void> {
  const res = await fetch(`${apiOrigin()}${path}`, { headers: tenantAuthHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? res.statusText, res.status);
  }
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const filename = match?.[1] ?? "export.csv";
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function exportStockBalances(facilityId: string): Promise<void> {
  await downloadCsv(`/api/v1/pharmacy/exports/stock-balances?facilityId=${encodeURIComponent(facilityId)}`);
}

export async function exportBatchExpiry(facilityId: string): Promise<void> {
  await downloadCsv(`/api/v1/pharmacy/exports/batch-expiry?facilityId=${encodeURIComponent(facilityId)}`);
}
