import { apiClient, apiOrigin, ApiError } from "./client";
import { tenantAuthHeaders } from "./auth";
import { queryString } from "./queryString";
import type { PagedResult } from "./types";

// Product catalog, stock list, batches, adjustments and CSV exports, backed by
// co.ehealth.platform.pharmacy.stock. The movement ledger lives in
// pharmacyLedger.ts and receiving in pharmacyReceiving.ts.

const BASE = "/api/v1/pharmacy";

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

export interface ListProductsParams {
  q?: string;
  activeOnly?: boolean;
  page?: number;
  size?: number;
}

export async function listProducts(params: ListProductsParams = {}): Promise<PagedResult<PharmacyProduct>> {
  return apiClient.get<PagedResult<PharmacyProduct>>(`${BASE}/products?${queryString({ ...params })}`, {
    headers: tenantAuthHeaders(),
  });
}

export async function getProduct(id: string): Promise<PharmacyProduct> {
  return apiClient.get<PharmacyProduct>(`${BASE}/products/${id}`, { headers: tenantAuthHeaders() });
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
  return apiClient.post<PharmacyProduct>(`${BASE}/products`, payload, { headers: tenantAuthHeaders() });
}

// The backend overwrites every field it receives, so `schedule`, `coldChain`
// and `preferredSupplierId` must always carry the product's current value:
// leaving one out would clear it.
export interface UpdateProductPayload {
  displayName: string;
  genericName?: string;
  strength?: string;
  dosageForm?: string;
  packSize?: number;
  barcode?: string;
  manufacturer?: string;
  storageInstructions?: string;
  schedule: DrugSchedule | null;
  coldChain: boolean;
  preferredSupplierId: string | null;
  // Reorder levels belong to the facility's assortment, not the catalog
  // product, so changing them needs the facility they apply to.
  facilityId?: string;
  reorderThreshold?: number;
  targetQuantity?: number;
}

export async function updateProduct(id: string, payload: UpdateProductPayload): Promise<PharmacyProduct> {
  return apiClient.patch<PharmacyProduct>(`${BASE}/products/${id}`, payload, { headers: tenantAuthHeaders() });
}

export async function archiveProduct(id: string): Promise<PharmacyProduct> {
  return apiClient.post<PharmacyProduct>(`${BASE}/products/${id}/archive`, undefined, {
    headers: tenantAuthHeaders(),
  });
}

export async function reactivateProduct(id: string): Promise<PharmacyProduct> {
  return apiClient.post<PharmacyProduct>(`${BASE}/products/${id}/reactivate`, undefined, {
    headers: tenantAuthHeaders(),
  });
}

/** The display label the server puts on a stock row. */
export type StockStatus = "In stock" | "Low stock" | "Out of stock";

/** Server-side narrowing of the stock list (`?status=`). */
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
  /** Archived products only appear while they still hold stock. */
  archived: boolean;
}

export interface ListStockParams {
  facilityId: string;
  q?: string;
  status?: StockStatusFilter;
  page?: number;
  size?: number;
}

export async function listStock(params: ListStockParams): Promise<PagedResult<StockRow>> {
  return apiClient.get<PagedResult<StockRow>>(`${BASE}/stock?${queryString({ ...params })}`, {
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
  return apiClient.get<StockDashboard>(`${BASE}/dashboard?${queryString({ facilityId })}`, {
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
  const response = await apiClient.get<{ items: BatchRow[] }>(`${BASE}/products/${productId}/batches`, {
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
  /** The adjusted lot's balance, not the product's total. */
  lotBalanceAfter: number;
}

// The key identifies one submit attempt, so a retry of that attempt can never
// write a second ledger entry.
export async function adjustStock(payload: AdjustStockPayload, idempotencyKey: string): Promise<AdjustmentResult> {
  return apiClient.post<AdjustmentResult>(`${BASE}/adjustments`, payload, {
    headers: { ...tenantAuthHeaders(), "Idempotency-Key": idempotencyKey },
  });
}

// apiOrigin() prefix is required, not cosmetic: a bare relative path only
// resolves correctly when the frontend and backend share an origin. In the dev
// setup (5173 vs 8081) it silently hits Vite's SPA fallback and downloads
// index.html instead of the CSV. apiClient already prefixes every call; this
// bypasses it (CSV isn't JSON) and so has to repeat the prefixing itself.
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
  await downloadCsv(`${BASE}/exports/stock-balances?${queryString({ facilityId })}`);
}

export async function exportBatchExpiry(facilityId: string): Promise<void> {
  await downloadCsv(`${BASE}/exports/batch-expiry?${queryString({ facilityId })}`);
}
