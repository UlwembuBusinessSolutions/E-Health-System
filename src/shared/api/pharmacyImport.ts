import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";
import { queryString } from "./queryString";

// Import products and stock from a spreadsheet, backed by
// co.ehealth.platform.pharmacy.csvimport.

const BASE = "/api/v1/pharmacy/import";

/** One line of the sheet exactly as typed; every value is text so a bad one is reported against its row. */
export interface ImportRow {
  sku: string;
  name: string;
  category: string;
  unit: string;
  packSize: string;
  schedule: string;
  lot: string;
  expiry: string;
  quantity: string;
  supplier: string;
  invoice: string;
  /** The pharmacist's decision "this look-alike SKU really is a new product". */
  confirmNewProduct: boolean;
}

/** RESTOCK adds a lot to a product that exists, NEW_PRODUCT creates it, PROBLEM waits for a decision. */
export type ImportRowStatus = "RESTOCK" | "NEW_PRODUCT" | "PROBLEM";

export type ImportProblem =
  | "MISSING_SKU"
  | "UNKNOWN_SKU"
  | "SIMILAR_SKU"
  | "MISSING_NAME"
  | "ALREADY_IN_CATALOGUE"
  | "ARCHIVED_PRODUCT"
  | "SERIAL_PRODUCT"
  | "COLD_CHAIN_PRODUCT"
  | "BAD_CATEGORY"
  | "BAD_UNIT"
  | "BAD_PACK_SIZE"
  | "BAD_SCHEDULE"
  | "BAD_QUANTITY"
  | "MISSING_LOT"
  | "BAD_EXPIRY"
  | "EXPIRED"
  | "DUPLICATE_LOT"
  | "LOT_EXPIRY_MISMATCH"
  | "UNKNOWN_SUPPLIER"
  | "SIMILAR_SUPPLIER";

export interface ImportRowResult {
  rowNumber: number;
  status: ImportRowStatus;
  problem: ImportProblem | null;
  /** Plain-language explanation of the problem; empty when the row is fine. */
  hint: string;
  /** A SKU or supplier name the server thinks was meant. */
  suggestion: string | null;
  /** Something worth a look that does not stop the import, e.g. an invoice that was already received. */
  warning: string | null;
  productCode: string | null;
  productName: string | null;
  lot: string | null;
  expiry: string | null;
  quantity: number;
  supplierName: string | null;
  invoice: string | null;
  scheduled: boolean;
}

export interface ImportSummary {
  total: number;
  ready: number;
  problems: number;
  newProducts: number;
  restockRows: number;
  units: number;
  scheduledRows: number;
}

export interface ImportCheckResponse {
  rows: ImportRowResult[];
  summary: ImportSummary;
  allOk: boolean;
}

export interface ImportPayload {
  /** Applied to every row that does not name its own supplier. */
  supplierId: string | null;
  /** Applied to every row that does not carry its own invoice number. */
  invoiceNumber: string;
  rows: ImportRow[];
}

export interface ImportResult {
  batchId: string;
  rowsImported: number;
  productsCreated: number;
  receiptsCreated: number;
  unitsReceived: number;
  scheduledRows: number;
}

export interface ImportBatch {
  id: string;
  fileName: string | null;
  status: "ACTIVE" | "UNDONE";
  rowsImported: number;
  productsCreated: number;
  receiptsCreated: number;
  unitsReceived: number;
  createdByName: string;
  createdAt: string;
  /** True while the import is active and inside the 24-hour undo window. */
  canUndo: boolean;
  undoableUntil: string;
  undoneAt: string | null;
}

/** Nothing is saved: says what each row would do. */
export function checkImport(payload: ImportPayload): Promise<ImportCheckResponse> {
  return apiClient.post<ImportCheckResponse>(`${BASE}/check`, payload, { headers: tenantAuthHeaders() });
}

/** Applies a clean sheet in one go. Refused while any row still has a problem. */
export function runImport(payload: ImportPayload & { facilityId: string; fileName: string }): Promise<ImportResult> {
  return apiClient.post<ImportResult>(BASE, payload, { headers: tenantAuthHeaders() });
}

/** Takes back everything the import added. Refused once its stock has been used, or after 24 hours. */
export function undoImport(batchId: string): Promise<ImportBatch> {
  return apiClient.post<ImportBatch>(`${BASE}/${batchId}/undo`, {}, { headers: tenantAuthHeaders() });
}

export async function listRecentImports(facilityId: string): Promise<ImportBatch[]> {
  const response = await apiClient.get<{ items: ImportBatch[] }>(`${BASE}/recent?${queryString({ facilityId })}`, {
    headers: tenantAuthHeaders(),
  });
  return response.items;
}
