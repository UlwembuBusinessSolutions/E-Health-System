import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";
import { queryString } from "./queryString";
import type { PagedResult } from "./types";
import type { ExpiryPrecision } from "./pharmacyStock";

// The stock movement ledger and the goods-received receipts it was posted
// from, backed by co.ehealth.platform.pharmacy.stock and .receiving.

const BASE = "/api/v1/pharmacy";

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
  /** The ledger entry; a transaction can post several entries. */
  id: string;
  seq: number;
  /** The posted transaction this entry belongs to - what a reversal targets. */
  transactionId: string;
  type: LedgerTransactionType;
  productId: string;
  productName: string;
  productCode: string;
  batchId: string;
  lotNumber: string;
  expiryDate: string | null;
  quantityDelta: number;
  /** The lot's balance after this entry. */
  balanceAfter: number;
  /** The product's total across lots after this entry; only on a product's history. */
  runningBalance: number | null;
  actorName: string;
  /** Free-text note. */
  reason: string | null;
  /** The picked reason (an `AdjustmentReason` or `ReversalReason` name). */
  reasonCode: string | null;
  sourceReference: string | null;
  supplierId: string | null;
  supplierName: string | null;
  patientId: string | null;
  patientName: string | null;
  prescriptionSerial: string | null;
  /** Set on a REVERSAL entry: the transaction it cancelled. */
  reversalOfTransactionId: string | null;
  /** Set when a later REVERSAL cancelled this entry's transaction. */
  reversedByTransactionId: string | null;
  /** True once part of the lot this entry added has been dispensed or removed. */
  stockUsed: boolean;
  createdAt: string;
}

export interface MovementsPage extends PagedResult<LedgerMovement> {
  /** Entries per transaction type under the other active filters, for the type chips. */
  typeCounts: Partial<Record<LedgerTransactionType, number>>;
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

export async function listMovements({ types, ...params }: ListMovementsParams): Promise<MovementsPage> {
  const search = queryString({ ...params, type: types?.join(",") });
  return apiClient.get<MovementsPage>(`${BASE}/ledger?${search}`, { headers: tenantAuthHeaders() });
}

/** One product's ledger entries, newest first, each carrying the product's running balance. */
export async function listProductHistory(
  productId: string,
  params: { facilityId: string; page?: number; size?: number },
): Promise<PagedResult<LedgerMovement>> {
  return apiClient.get<PagedResult<LedgerMovement>>(
    `${BASE}/products/${productId}/history?${queryString(params)}`,
    { headers: tenantAuthHeaders() },
  );
}

/**
 * The product's current total, read as the newest history entry's running
 * balance. Used for the "stock goes from A to B" preview.
 */
export async function getCurrentBalance(facilityId: string, productId: string): Promise<number | null> {
  const page = await listProductHistory(productId, { facilityId, page: 0, size: 1 });
  return page.items[0]?.runningBalance ?? null;
}

export type ReversalReason = "WRONG_ENTRY" | "DUPLICATE_ENTRY" | "RETURNED_TO_SUPPLIER" | "OTHER";

export interface ReversePayload {
  reason: ReversalReason;
  /** Required (at least 3 characters) when the reason is OTHER. */
  note?: string;
}

export interface ReverseTransactionResult {
  transactionId: string;
  reversedTransactionId: string;
}

// No idempotency key: the server allows one reversal per transaction, so a
// retried request answers 409 instead of reversing twice.
export async function reverseTransaction(
  transactionId: string,
  payload: ReversePayload,
): Promise<ReverseTransactionResult> {
  return apiClient.post<ReverseTransactionResult>(`${BASE}/transactions/${transactionId}/reverse`, payload, {
    headers: tenantAuthHeaders(),
  });
}

/** Where a receipt itself stands; only POSTED and REVERSED receipts are ever listed. */
export type ReceiptStatus = "DRAFT" | "POSTED" | "CANCELLED" | "REVERSED";
/** Where one line's stock stands now. */
export type ReceiptLineState = "ON_SHELF" | "PARTLY_USED" | "REVERSED";
export type ReceiptFlagReason = "DAMAGED" | "SHORT" | "WRONG_ITEM" | "NEAR_EXPIRY";

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
  productCode: string;
  productName: string;
  lotNumber: string;
  expiryDate: string | null;
  expiryPrecision: ExpiryPrecision | null;
  /** Units that went on the shelf. */
  quantity: number;
  /** Units that arrived but were refused at the door. */
  rejectedQuantity: number;
  state: ReceiptLineState;
  /** Set when the line was queried at the door (damaged, short, ...). */
  flag: { reason: ReceiptFlagReason; note: string | null; acceptedQuantity: number } | null;
  temperatureC: number | null;
  coldBoxIntact: boolean | null;
}

export interface ReceiptDetail extends ReceiptSummary {
  reversedAt: string | null;
  reversedByName: string | null;
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
  return apiClient.get<PagedResult<ReceiptSummary>>(`${BASE}/receipts?${queryString({ ...params })}`, {
    headers: tenantAuthHeaders(),
  });
}

export async function getReceipt(id: string): Promise<ReceiptDetail> {
  return apiClient.get<ReceiptDetail>(`${BASE}/receipts/${id}`, { headers: tenantAuthHeaders() });
}

/**
 * Takes every line of the receipt off the shelf in one go. The server wants a
 * single free-text `reason` (no separate note) and answers with the updated
 * receipt.
 */
export async function reverseReceipt(receiptId: string, reason: string): Promise<ReceiptDetail> {
  return apiClient.post<ReceiptDetail>(`${BASE}/receipts/${receiptId}/reverse`, { reason }, {
    headers: tenantAuthHeaders(),
  });
}
