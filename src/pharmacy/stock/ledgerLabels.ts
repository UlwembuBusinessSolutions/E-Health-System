import type { LedgerEntry } from "@/shared/api/pharmacyStock";
import { reasonLabel } from "./adjustStockModel";

// Keyed by StockTransactionType. Several raw types read the same to a
// pharmacist (a write-off and a negative adjustment are both "Removed").
const TYPE_LABELS: Record<string, string> = {
  OPENING_BALANCE: "Opening balance",
  RECEIPT: "Received",
  DISPENSE: "Dispensed",
  WRITE_OFF: "Removed",
  ADJUSTMENT_NEGATIVE: "Removed",
  ADJUSTMENT_POSITIVE: "Added",
  REVERSAL: "Reversed",
  TRANSFER_DISPATCH: "Sent out",
  TRANSFER_RECEIPT: "Transferred in",
};

function humanise(code: string): string {
  const words = code.toLowerCase().split("_").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function ledgerTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? humanise(type);
}

export interface EntrySource {
  /** Supplier, patient or reason - whichever explains the movement. */
  who: string;
  /** Invoice, prescription or other reference, shown beneath. */
  reference: string | null;
}

export function describeEntrySource(entry: LedgerEntry): EntrySource {
  if (entry.supplierName) return { who: entry.supplierName, reference: entry.sourceReference };
  if (entry.patientName) {
    return { who: entry.patientName, reference: entry.prescriptionSerial ?? entry.sourceReference };
  }
  if (entry.reason) return { who: reasonLabel(entry.reason) ?? humanise(entry.reason), reference: entry.sourceReference };
  return { who: "—", reference: entry.sourceReference };
}

/** `+1,200` / `−12` with a real minus sign so it reads clearly beside a plus. */
export function formatDelta(delta: number): string {
  const magnitude = Math.abs(delta).toLocaleString("en-ZA");
  return delta < 0 ? `−${magnitude}` : `+${magnitude}`;
}
