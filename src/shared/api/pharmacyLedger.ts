import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

// Ledger movements and goods-received receipts (Docs/pharmacy-module-contract.md,
// sections B1 and B2). Every request and response type for those screens lives
// here so the integrator can reconcile them with the real backend in one place.
//
// Assumptions beyond the contract text, marked where used:
//  - `type` on GET /ledger accepts a comma-separated list of transaction types.
//  - GET /ledger may return `typeCounts` (entries per transaction type under
//    the other active filters) so the type chips can show counts.
//  - A ledger entry may carry `stockUsed` (true once part of the received lot
//    has been dispensed or removed) so the UI can hide a Reverse button that
//    would be refused anyway. When absent the server's 409 is the safety net.

export interface PagedResult<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  hasMore: boolean;
}

export type LedgerTransactionType =
  | "OPENING_BALANCE"
  | "RECEIPT"
  | "ADJUSTMENT_POSITIVE"
  | "ADJUSTMENT_NEGATIVE"
  | "HOLD"
  | "RELEASE"
  | "WRITE_OFF"
  | "REVERSAL"
  | "DISPENSE"
  | "TRANSFER_DISPATCH"
  | "TRANSFER_RECEIPT";

export interface LedgerMovement {
  id: string;
  seq: number;
  type: LedgerTransactionType;
  productId: string;
  productName: string;
  productCode: string;
  lotNumber: string | null;
  expiryDate: string | null;
  quantityDelta: number;
  balanceAfter: number;
  actorName: string;
  reason: string | null;
  sourceReference: string | null;
  supplierId: string | null;
  supplierName: string | null;
  patientId: string | null;
  patientName: string | null;
  prescriptionSerial: string | null;
  /** Set when a later REVERSAL entry cancelled this one. */
  reversedByTransactionId: string | null;
  /** Set on a REVERSAL entry: the entry it cancelled. */
  reversesTransactionId?: string | null;
  stockUsed?: boolean;
  createdAt: string;
}

export interface MovementsPage extends PagedResult<LedgerMovement> {
  typeCounts?: Partial<Record<LedgerTransactionType, number>>;
}

export interface ListMovementsParams {
  facilityId: string;
  productId?: string;
  /** Transaction types to include; sent comma-separated. */
  types?: LedgerTransactionType[];
  supplierId?: string;
  patientId?: string;
  q?: string;
  /** Inclusive calendar days, `YYYY-MM-DD`. */
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

function appendIfSet(search: URLSearchParams, key: string, value: string | number | undefined): void {
  if (value !== undefined && value !== "") search.set(key, String(value));
}

export async function listMovements(params: ListMovementsParams): Promise<MovementsPage> {
  const search = new URLSearchParams({ facilityId: params.facilityId });
  appendIfSet(search, "productId", params.productId);
  appendIfSet(search, "type", params.types?.join(","));
  appendIfSet(search, "supplierId", params.supplierId);
  appendIfSet(search, "patientId", params.patientId);
  appendIfSet(search, "q", params.q);
  appendIfSet(search, "from", params.from);
  appendIfSet(search, "to", params.to);
  appendIfSet(search, "page", params.page);
  appendIfSet(search, "size", params.size);
  return apiClient.get<MovementsPage>(`/api/v1/pharmacy/ledger?${search.toString()}`, {
    headers: tenantAuthHeaders(),
  });
}

/**
 * The product's current balance, read as the newest history entry's running
 * balance (GET /products/{id}/history is newest first). Used for the
 * "stock goes from A to B" preview.
 */
export async function getCurrentBalance(facilityId: string, productId: string): Promise<number | null> {
  const search = new URLSearchParams({ facilityId, page: "0", size: "1" });
  const page = await apiClient.get<PagedResult<LedgerMovement>>(
    `/api/v1/pharmacy/products/${productId}/history?${search.toString()}`,
    { headers: tenantAuthHeaders() },
  );
  return page.items[0]?.balanceAfter ?? null;
}

export type ReversalReason =
  | "WRONG_QUANTITY"
  | "WRONG_PRODUCT"
  | "DUPLICATE_ENTRY"
  | "RECEIVED_BY_MISTAKE"
  | "OTHER";

export interface ReversePayload {
  reason: ReversalReason;
  note?: string;
}

export interface ReverseTransactionResult {
  reversalTransactionId: string;
}

export async function reverseTransaction(
  transactionId: string,
  payload: ReversePayload,
  idempotencyKey: string,
): Promise<ReverseTransactionResult> {
  return apiClient.post<ReverseTransactionResult>(
    `/api/v1/pharmacy/transactions/${transactionId}/reverse`,
    payload,
    { headers: { ...tenantAuthHeaders(), "Idempotency-Key": idempotencyKey } },
  );
}

export type ReceiptStatus = "ON_SHELF" | "PARTLY_USED" | "REVERSED";
export type ReceiptLineState = ReceiptStatus;

export interface ReceiptSummary {
  id: string;
  receiptNumber: string;
  supplierId: string | null;
  supplierName: string | null;
  invoiceNumber: string | null;
  receivedAt: string;
  receivedByName: string;
  lineCount: number;
  totalUnits: number;
  status: ReceiptStatus;
  /** True when any line's stock was dispensed or removed - the receipt can no longer be reversed. */
  usedStock: boolean;
}

export interface ReceiptLine {
  id: string;
  productId: string;
  productName: string;
  lotNumber: string | null;
  expiryDate: string | null;
  quantity: number;
  state: ReceiptLineState;
  /** Receiving flag (damaged, short, ...) recorded against the line, if any. */
  flagReason: string | null;
}

export interface ReceiptDetail extends ReceiptSummary {
  lines: ReceiptLine[];
}

export interface ListReceiptsParams {
  facilityId: string;
  supplierId?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

export async function listReceipts(params: ListReceiptsParams): Promise<PagedResult<ReceiptSummary>> {
  const search = new URLSearchParams({ facilityId: params.facilityId });
  appendIfSet(search, "supplierId", params.supplierId);
  appendIfSet(search, "q", params.q);
  appendIfSet(search, "from", params.from);
  appendIfSet(search, "to", params.to);
  appendIfSet(search, "page", params.page);
  appendIfSet(search, "size", params.size);
  return apiClient.get<PagedResult<ReceiptSummary>>(`/api/v1/pharmacy/receipts?${search.toString()}`, {
    headers: tenantAuthHeaders(),
  });
}

export async function getReceipt(id: string): Promise<ReceiptDetail> {
  return apiClient.get<ReceiptDetail>(`/api/v1/pharmacy/receipts/${id}`, { headers: tenantAuthHeaders() });
}

export interface ReverseReceiptResult {
  receiptId: string;
  reversedLineCount: number;
}

export async function reverseReceipt(
  receiptId: string,
  payload: ReversePayload,
  idempotencyKey: string,
): Promise<ReverseReceiptResult> {
  return apiClient.post<ReverseReceiptResult>(`/api/v1/pharmacy/receipts/${receiptId}/reverse`, payload, {
    headers: { ...tenantAuthHeaders(), "Idempotency-Key": idempotencyKey },
  });
}

/** Supplier names for the receipts filter chips (GET /suppliers, B2). */
export interface SupplierOption {
  id: string;
  name: string;
}

export async function listSupplierOptions(): Promise<SupplierOption[]> {
  const page = await apiClient.get<PagedResult<SupplierOption>>("/api/v1/pharmacy/suppliers?status=ACTIVE&size=50", {
    headers: tenantAuthHeaders(),
  });
  return page.items;
}
