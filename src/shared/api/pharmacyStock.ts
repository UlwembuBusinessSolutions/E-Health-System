import { apiClient, apiOrigin, ApiError } from "./client";
import { tenantAuthHeaders } from "./auth";

// Phase 1 of Docs/pharmacy-stock-ledger-plan.md — product catalog, batches
// and receiving, backed by co.ehealth.platform.pharmacy.stock. Deliberately
// separate from pharmacy.ts (the existing prescription/dispensing client):
// that module has no stock/batch concept yet (Phase 3 wires the two
// together), and this file exists independently of it until then.

export type StockCategory = "MEDICINE" | "SUPPLY" | "DEVICE";
export type StockBaseUnit = "TABLET" | "CAPSULE" | "BOTTLE" | "VIAL" | "SEALED_PACK" | "BOX" | "KIT" | "EACH";
export type ExpiryPrecision = "DAY" | "MONTH";
/** SAHPRA schedule of a controlled medicine; null on the product means unscheduled. */
export type DrugSchedule = "S5" | "S6";

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
  /** One ledger identity per unit (devices). Mutually exclusive with batchTracked. */
  serialTracked: boolean;
  schedule: DrugSchedule | null;
  coldChain: boolean;
  preferredSupplierId: string | null;
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
  serialTracked: boolean;
  schedule?: DrugSchedule;
  coldChain: boolean;
  preferredSupplierId?: string;
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
  preferredSupplierId?: string | null;
  // The reorder level belongs to the facility's assortment, not the catalog
  // product, so changing it needs the facility it applies to.
  facilityId?: string;
  reorderThreshold?: number;
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

/** Server-side narrowing of the stock list; archived products are listed separately. */
export type StockStatusFilter = "LOW" | "OUT" | "EXPIRING";

export interface StockRow {
  productId: string;
  code: string;
  displayName: string;
  baseUnit: StockBaseUnit;
  available: number;
  reorderThreshold: number | null;
  status: StockStatus;
  nextExpiry: string | null;
  serialTracked: boolean;
  schedule: DrugSchedule | null;
  lotCount: number;
  archived: boolean;
}

export interface ListStockParams {
  facilityId: string;
  q?: string;
  status?: StockStatusFilter;
  archived?: boolean;
  page?: number;
  size?: number;
}

export async function listStock(params: ListStockParams): Promise<PagedResult<StockRow>> {
  const search = new URLSearchParams({ facilityId: params.facilityId });
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.archived) search.set("archived", "true");
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.size !== undefined) search.set("size", String(params.size));
  return apiClient.get<PagedResult<StockRow>>(`/api/v1/pharmacy/stock?${search.toString()}`, {
    headers: tenantAuthHeaders(),
  });
}

export interface StockDashboard {
  lowCount: number;
  outCount: number;
  expiringCount: number;
  expiredCount: number;
  awaitingCollectionCount: number;
}

export async function getStockDashboard(facilityId: string): Promise<StockDashboard> {
  return apiClient.get<StockDashboard>(`/api/v1/pharmacy/dashboard?facilityId=${encodeURIComponent(facilityId)}`, {
    headers: tenantAuthHeaders(),
  });
}

export interface BatchRow {
  batchId: string;
  lotNumber: string;
  manufacturer: string | null;
  expiryDate: string | null;
  expiryPrecision: ExpiryPrecision | null;
  quantity: number;
  /** Units still in stock from this lot; empty unless the product is serial-tracked. */
  serialNumbers: string[];
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
  expiryDate: string | null;
  supplierId: string | null;
  supplierName: string | null;
  patientId: string | null;
  patientName: string | null;
  prescriptionSerial: string | null;
  reversedByTransactionId: string | null;
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

export interface ListProductHistoryParams {
  facilityId: string;
  page?: number;
  size?: number;
}

/** One product's ledger entries, each carrying its running balance. */
export async function listProductHistory(
  productId: string,
  params: ListProductHistoryParams,
): Promise<PagedResult<LedgerEntry>> {
  const search = new URLSearchParams({ facilityId: params.facilityId });
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.size !== undefined) search.set("size", String(params.size));
  return apiClient.get<PagedResult<LedgerEntry>>(
    `/api/v1/pharmacy/products/${productId}/history?${search.toString()}`,
    { headers: tenantAuthHeaders() },
  );
}

export interface ExpiryLot {
  productId: string;
  productName: string;
  productCode: string;
  baseUnit: StockBaseUnit;
  batchId: string;
  lotNumber: string;
  expiryDate: string;
  quantity: number;
}

/** Lots expiring within `days`, plus already-expired lots that still hold stock. */
export async function listExpiry(facilityId: string, days = 90): Promise<ExpiryLot[]> {
  const search = new URLSearchParams({ facilityId, days: String(days) });
  const response = await apiClient.get<{ items: ExpiryLot[] }>(`/api/v1/pharmacy/expiry?${search.toString()}`, {
    headers: tenantAuthHeaders(),
  });
  return response.items;
}

export type AdjustmentMode = "ADD" | "REMOVE";
export type RemoveReason = "EXPIRED" | "DAMAGED" | "RECALLED" | "LOST_OR_STOLEN" | "WRONG_ENTRY" | "OTHER";
export type AddReason = "FOUND_IN_COUNT" | "RETURNED_BY_PATIENT" | "RETURNED_FROM_WARD" | "WRONG_ENTRY" | "OTHER";
export type AdjustmentReason = RemoveReason | AddReason;

export interface AdjustStockPayload {
  facilityId: string;
  productId: string;
  batchId?: string;
  /** Serial-tracked products only; `quantity` must equal the number of serials. */
  serialNumbers?: string[];
  mode: AdjustmentMode;
  quantity: number;
  reason: AdjustmentReason;
  /** Required (at least 3 characters) when the reason is OTHER. */
  note?: string;
}

export interface AdjustmentResult {
  transactionId: string;
  quantityDelta: number;
  balanceAfter: number;
}

// Same why-note as receiveStock: the key identifies one submit attempt, so a
// retry of that attempt can never write a second ledger entry.
export async function adjustStock(payload: AdjustStockPayload, idempotencyKey: string): Promise<AdjustmentResult> {
  return apiClient.post<AdjustmentResult>("/api/v1/pharmacy/adjustments", payload, {
    headers: { ...tenantAuthHeaders(), "Idempotency-Key": idempotencyKey },
  });
}

export interface SupplierOption {
  id: string;
  name: string;
}

// A minimal read of the suppliers list, only to fill the "usual supplier"
// pickers. The full supplier client lives in pharmacyReceiving.ts.
export async function listSupplierOptions(): Promise<SupplierOption[]> {
  const response = await apiClient.get<{ items: SupplierOption[] }>("/api/v1/pharmacy/suppliers?status=ACTIVE&size=100", {
    headers: tenantAuthHeaders(),
  });
  return response.items;
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
