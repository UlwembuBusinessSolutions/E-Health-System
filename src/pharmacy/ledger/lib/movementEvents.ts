import type { LedgerMovement, LedgerTransactionType, ReversalReason } from "@/shared/api/pharmacyLedger";

// Pharmacists think in six plain events, not eleven transaction types.
export type MovementEventKind = "RECEIVED" | "DISPENSED" | "REMOVED" | "REVERSAL" | "ADJUSTED" | "OPENING";

const KIND_BY_TYPE: Record<LedgerTransactionType, MovementEventKind> = {
  RECEIPT: "RECEIVED",
  TRANSFER_RECEIPT: "RECEIVED",
  DISPENSE: "DISPENSED",
  WRITE_OFF: "REMOVED",
  ADJUSTMENT_NEGATIVE: "REMOVED",
  TRANSFER_DISPATCH: "REMOVED",
  REVERSAL: "REVERSAL",
  ADJUSTMENT_POSITIVE: "ADJUSTED",
  HOLD: "ADJUSTED",
  RELEASE: "ADJUSTED",
  OPENING_BALANCE: "OPENING",
};

export const EVENT_LABELS: Record<MovementEventKind, string> = {
  RECEIVED: "Received",
  DISPENSED: "Dispensed",
  REMOVED: "Removed",
  REVERSAL: "Reversal",
  ADJUSTED: "Adjusted",
  OPENING: "Opening",
};

export const EVENT_KINDS = Object.keys(EVENT_LABELS) as MovementEventKind[];

export function eventKindOf(type: LedgerTransactionType): MovementEventKind {
  return KIND_BY_TYPE[type];
}

/** The transaction types a chip stands for, sent to the server as the `type` filter. */
export function typesForKind(kind: MovementEventKind): LedgerTransactionType[] {
  return (Object.keys(KIND_BY_TYPE) as LedgerTransactionType[]).filter((type) => KIND_BY_TYPE[type] === kind);
}

/** Sums the server's per-type counts into the per-chip counts. */
export function countsByKind(
  typeCounts: Partial<Record<LedgerTransactionType, number>> | undefined,
): Partial<Record<MovementEventKind, number>> | undefined {
  if (!typeCounts) return undefined;
  const totals: Partial<Record<MovementEventKind, number>> = {};
  for (const [type, count] of Object.entries(typeCounts) as [LedgerTransactionType, number][]) {
    const kind = KIND_BY_TYPE[type];
    totals[kind] = (totals[kind] ?? 0) + count;
  }
  return totals;
}

/** `+90` / `−30` (a real minus sign) so the direction never relies on colour alone. */
export function signedChange(delta: number): string {
  if (delta > 0) return `+${delta.toLocaleString("en-ZA")}`;
  if (delta < 0) return `−${Math.abs(delta).toLocaleString("en-ZA")}`;
  return "0";
}

export function isReversed(movement: LedgerMovement): boolean {
  return movement.reversedByTransactionId !== null;
}

/** Only a plain receipt line can be undone here; everything else is corrected by a new entry. */
export function canReverse(movement: LedgerMovement): boolean {
  return movement.type === "RECEIPT" && !isReversed(movement) && !movement.stockUsed;
}

export function isStockUsed(movement: LedgerMovement): boolean {
  return movement.type === "RECEIPT" && !isReversed(movement) && movement.stockUsed === true;
}

/** Who or what the movement was with: supplier, patient, or the stated reason. */
export function counterpartyOf(movement: LedgerMovement): string | null {
  return movement.supplierName ?? movement.patientName ?? movement.reason;
}

/** The document the movement came from: prescription or free-text reference (invoice). */
export function referenceOf(movement: LedgerMovement): string | null {
  return movement.prescriptionSerial ?? movement.sourceReference;
}

export const REVERSAL_REASONS: { value: ReversalReason; label: string }[] = [
  { value: "WRONG_QUANTITY", label: "Wrong quantity" },
  { value: "WRONG_PRODUCT", label: "Wrong product" },
  { value: "DUPLICATE_ENTRY", label: "Duplicate entry" },
  { value: "RECEIVED_BY_MISTAKE", label: "Received by mistake" },
  { value: "OTHER", label: "Other" },
];
